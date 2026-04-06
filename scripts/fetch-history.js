// scripts/fetch-history.js
// 일회성 실행: superkts.com/lotto/list/에서 역대 전체 회차 일괄 수집
// 결과를 data/lotto-history.json에 저장
//
// 사용법: node scripts/fetch-history.js
//
// update-lotto.js와의 차이:
// - 매주 자동 실행되는 update-lotto.js는 최근 3개 회차만 수집해서 lotto.json에 저장
// - 본 스크립트는 전체 회차를 일괄 수집해서 lotto-history.json에 저장 (1회 실행용)
// - 향후 새 회차는 update-lotto.js의 누적 모드 로직이 lotto-history.json에 추가

var fs = require('fs');
var path = require('path');
var https = require('https');

var DATA_DIR = path.join(__dirname, '..', 'data');

// ── HTTP GET ──
// Accept-Encoding: identity → 압축 비활성화 (gzip 응답을 디코딩 안 해서 깨지는 문제 회피)
function fetch(url) {
    return new Promise(function(resolve, reject) {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Encoding': 'identity'
            }
        }, function(res) {
            var data = '';
            res.setEncoding('utf8');
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() { resolve(data); });
        }).on('error', reject);
    });
}

// ── sleep ──
function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// ── 단일 페이지 HTML에서 회차 추출 ──
function extractRounds(html) {
    var rowRegex = /<tr><td>(\d+)<\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td>/g;
    var rounds = [];
    var match;
    while ((match = rowRegex.exec(html)) !== null) {
        var round = parseInt(match[1]);
        var numbers = [
            parseInt(match[2]), parseInt(match[3]), parseInt(match[4]),
            parseInt(match[5]), parseInt(match[6]), parseInt(match[7])
        ].sort(function(a, b) { return a - b; });
        var bonus = parseInt(match[8]);
        rounds.push({ round: round, numbers: numbers, bonus: bonus });
    }
    return rounds;
}

// ── superkts 전체 회차 페이지네이션 순회 수집 ──
async function fetchAllLottoHistory() {
    console.log('첫 페이지 fetch + 총 페이지 수 확인...');
    var firstHtml = await fetch('https://superkts.com/lotto/list/?pg=1');

    // pg=N 패턴에서 가장 큰 N 찾기 (pagination "끝" 링크 추출)
    var pgMatches = firstHtml.match(/pg=(\d+)/g) || [];
    var maxPg = 1;
    pgMatches.forEach(function(m) {
        var n = parseInt(m.replace('pg=', ''));
        if (n > maxPg) maxPg = n;
    });
    console.log('  총 페이지 수: ' + maxPg);

    var allRounds = [];
    var firstRounds = extractRounds(firstHtml);
    allRounds.push.apply(allRounds, firstRounds);
    console.log('  pg=1: ' + firstRounds.length + '개 수집 (누적 ' + allRounds.length + ')');

    for (var pg = 2; pg <= maxPg; pg++) {
        var html = await fetch('https://superkts.com/lotto/list/?pg=' + pg);
        var rounds = extractRounds(html);
        allRounds.push.apply(allRounds, rounds);

        // 빈 결과면 1회 재시도 (네트워크 깜빡임 대비)
        if (rounds.length === 0) {
            await sleep(500);
            html = await fetch('https://superkts.com/lotto/list/?pg=' + pg);
            rounds = extractRounds(html);
            allRounds.push.apply(allRounds, rounds);
            console.log('  ⚠ pg=' + pg + ' 재시도: ' + rounds.length + '개 (HTML 길이 ' + html.length + ')');
        }

        if (pg % 10 === 0 || pg === maxPg) {
            console.log('  pg=' + pg + ': 누적 ' + allRounds.length + '개 (이번 페이지 ' + rounds.length + '개)');
        }

        // superkts에 부담 안 주기 위해 sleep
        await sleep(200);
    }

    // 회차 번호로 추첨일 계산 (1회차 2002-12-07 + (round-1) * 7일)
    var firstDraw = new Date('2002-12-07');
    allRounds.forEach(function(r) {
        var drawDate = new Date(firstDraw.getTime() + (r.round - 1) * 7 * 24 * 60 * 60 * 1000);
        r.date = drawDate.toISOString().split('T')[0];
    });

    return allRounds;
}

// ── 메인 ──
async function main() {
    console.log('=== 역대 로또 회차 일괄 수집 시작 ===\n');
    var startTime = Date.now();

    try {
        var allRounds = await fetchAllLottoHistory();
        if (allRounds.length === 0) {
            console.error('  파싱 실패: 회차 데이터가 없습니다.');
            process.exit(1);
        }

        // 중복 제거 (혹시 페이지네이션 경계에서 중복 발생 가능성 대비)
        var seen = {};
        var uniqueRounds = [];
        allRounds.forEach(function(r) {
            if (!seen[r.round]) {
                seen[r.round] = true;
                uniqueRounds.push(r);
            }
        });

        // 최신 회차가 앞으로 오도록 정렬 (큰 번호 → 작은 번호)
        uniqueRounds.sort(function(a, b) { return b.round - a.round; });

        var historyData = {
            lastUpdated: new Date().toISOString(),
            totalRounds: uniqueRounds.length,
            rounds: uniqueRounds
        };

        fs.writeFileSync(
            path.join(DATA_DIR, 'lotto-history.json'),
            JSON.stringify(historyData, null, 2) + '\n'
        );

        var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('\n  수집 완료: 총 ' + uniqueRounds.length + '개 회차 (' + elapsed + '초)');
        console.log('  최신: ' + uniqueRounds[0].round + '회 (' + uniqueRounds[0].date + ')');
        console.log('  최초: ' + uniqueRounds[uniqueRounds.length - 1].round + '회 (' + uniqueRounds[uniqueRounds.length - 1].date + ')');
        console.log('  → data/lotto-history.json 저장 완료');
    } catch (e) {
        console.error('  오류:', e.message);
        process.exit(1);
    }

    console.log('\n=== 완료 ===');
}

main().catch(function(e) {
    console.error('치명적 오류:', e);
    process.exit(1);
});
