var fs = require('fs');
var path = require('path');
var https = require('https');

var DATA_DIR = path.join(__dirname, '..', 'data');

// ── HTTP GET ──
function fetch(url) {
    return new Promise(function(resolve, reject) {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() { resolve(data); });
        }).on('error', reject);
    });
}

// ── superkts.com에서 로또 당첨번호 파싱 ──
async function fetchLottoFromSuperkts() {
    console.log('superkts.com에서 로또 데이터 수집 중...');
    var html = await fetch('https://superkts.com/lotto/list/');

    var rowRegex = /<tr><td>(\d+)<\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td><td><span[^>]*>(\d+)<\/span><\/td>/g;

    var rounds = [];
    var match;

    while ((match = rowRegex.exec(html)) !== null && rounds.length < 3) {
        var round = parseInt(match[1]);
        var numbers = [
            parseInt(match[2]), parseInt(match[3]), parseInt(match[4]),
            parseInt(match[5]), parseInt(match[6]), parseInt(match[7])
        ].sort(function(a, b) { return a - b; });
        var bonus = parseInt(match[8]);

        var firstDraw = new Date('2002-12-07');
        var drawDate = new Date(firstDraw.getTime() + (round - 1) * 7 * 24 * 60 * 60 * 1000);
        var dateStr = drawDate.toISOString().split('T')[0];

        rounds.push({ round: round, date: dateStr, numbers: numbers, bonus: bonus });
    }

    // 각 회차별 상세 페이지에서 1등/2등 당첨금 가져오기
    for (var i = 0; i < rounds.length; i++) {
        try {
            var detailHtml = await fetch('https://superkts.com/lotto/' + rounds[i].round);

            // 1등 당첨금 (한글 표기)
            var prizes = detailHtml.match(/게임당 : <b>(\d+억[\s\d만]*원)/g);
            if (prizes && prizes.length >= 1) {
                var p1 = prizes[0].match(/게임당 : <b>(.+)/);
                if (p1) rounds[i].prize = p1[1].replace(/\s+/g, ' ').trim();
            }

            // 2등 당첨금 (한글 표기)
            if (prizes && prizes.length >= 2) {
                var p2 = prizes[1].match(/게임당 : <b>(.+)/);
                if (p2) rounds[i].prize2 = p2[1].replace(/\s+/g, ' ').trim();
            } else {
                // 2등이 억 단위가 아닌 경우 (만원 단위)
                var prize2Alt = detailHtml.match(/2등 당첨금[\s\S]*?게임당 : <b>(\d+만[\s\d]*원)/);
                if (prize2Alt) rounds[i].prize2 = prize2Alt[1].replace(/\s+/g, ' ').trim();
            }

            // 1등 당첨자 수
            var winnersMatch = detailHtml.match(/1등[\s\S]*?당첨 게임수 : <b>(\d+)/);
            if (winnersMatch) rounds[i].winners = parseInt(winnersMatch[1]);

            // 2등 당첨자 수
            var winners2Match = detailHtml.match(/2등[\s\S]*?당첨 게임수 : <b>(\d+)/);
            if (winners2Match) rounds[i].winners2 = parseInt(winners2Match[1]);
        } catch (e) {
            console.error('  ' + rounds[i].round + '회 당첨금 조회 실패');
        }
    }

    return rounds;
}

// ── pyony.com에서 연금복권 당첨번호 파싱 ──
async function fetchPensionFromPyony() {
    console.log('pyony.com에서 연금복권 데이터 수집 중...');
    var html = await fetch('https://pyony.com/lotto720/rounds/');

    var results = [];

    // 회차별 블록 분리: "309회 (2026년 4월 2일 추첨)" 패턴
    var roundHeaderRegex = /(\d+)회\s*\((\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*추첨\)/g;
    var headers = [];
    var match;

    while ((match = roundHeaderRegex.exec(html)) !== null) {
        headers.push({
            round: parseInt(match[1]),
            date: match[2] + '-' + match[3].padStart(2, '0') + '-' + match[4].padStart(2, '0'),
            index: match.index
        });
    }

    // 각 회차 블록에서 1등 당첨번호 추출
    for (var i = 0; i < Math.min(headers.length, 3); i++) {
        var startIdx = headers[i].index;
        var endIdx = (i + 1 < headers.length) ? headers[i + 1].index : html.length;
        var block = html.substring(startIdx, endIdx);

        // 1등 행에서 "N조" + 6자리 숫자 추출
        // 패턴: <th...>1등</th> ... <td>N조</td> <td>d</td> x6
        var firstPrizeMatch = block.match(/1등[\s\S]*?<td>(\d)조<\/td>\s*<td>(\d)<\/td>\s*<td>(\d)<\/td>\s*<td>(\d)<\/td>\s*<td>(\d)<\/td>\s*<td>(\d)<\/td>\s*<td>(\d)<\/td>/);

        if (firstPrizeMatch) {
            results.push({
                round: headers[i].round,
                date: headers[i].date,
                group: parseInt(firstPrizeMatch[1]),
                numbers: [
                    parseInt(firstPrizeMatch[2]), parseInt(firstPrizeMatch[3]),
                    parseInt(firstPrizeMatch[4]), parseInt(firstPrizeMatch[5]),
                    parseInt(firstPrizeMatch[6]), parseInt(firstPrizeMatch[7])
                ]
            });
        }
    }

    return results;
}

// ── 메인 ──
async function main() {
    console.log('=== 당첨번호 자동 업데이트 시작 ===\n');

    // 로또
    try {
        var lottoResults = await fetchLottoFromSuperkts();
        if (lottoResults.length > 0) {
            fs.writeFileSync(
                path.join(DATA_DIR, 'lotto.json'),
                JSON.stringify(lottoResults, null, 4) + '\n'
            );
            lottoResults.forEach(function(r) {
                console.log('  로또 ' + r.round + '회 (' + r.date + '): ' + r.numbers.join(', ') + ' + 보너스 ' + r.bonus);
            });
            console.log('  → lotto.json 업데이트 완료\n');
        } else {
            console.log('  로또 파싱 실패, 기존 데이터 유지\n');
        }
    } catch (e) {
        console.error('  로또 수집 오류:', e.message, '\n');
    }

    // 연금복권
    try {
        var pensionResults = await fetchPensionFromPyony();
        if (pensionResults.length > 0) {
            fs.writeFileSync(
                path.join(DATA_DIR, 'pension.json'),
                JSON.stringify(pensionResults, null, 4) + '\n'
            );
            pensionResults.forEach(function(r) {
                console.log('  연금복권 ' + r.round + '회 (' + r.date + '): ' + r.group + '조 ' + r.numbers.join(''));
            });
            console.log('  → pension.json 업데이트 완료\n');
        } else {
            console.log('  연금복권 파싱 실패, 기존 데이터 유지\n');
        }
    } catch (e) {
        console.error('  연금복권 수집 오류:', e.message, '\n');
    }

    console.log('=== 완료 ===');
}

main().catch(function(e) {
    console.error('치명적 오류:', e);
    process.exit(1);
});
