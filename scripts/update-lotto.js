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

// ── 금액을 한글로 변환 ──
function formatKoreanMoney(amount) {
    if (amount >= 100000000) {
        var eok = Math.floor(amount / 100000000);
        var man = Math.floor((amount % 100000000) / 10000);
        if (man > 0) return eok + '억 ' + man + '만원';
        return eok + '억원';
    } else if (amount >= 10000) {
        var man = Math.floor(amount / 10000);
        return man + '만원';
    }
    return amount.toLocaleString() + '원';
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

    // 각 회차별 당첨금 가져오기 (pyony.com 상세 페이지)
    for (var i = 0; i < rounds.length; i++) {
        try {
            var detailHtml = await fetch('https://pyony.com/lotto/rounds/' + rounds[i].round + '/');

            // 1등~3등 당첨금 + 당첨자 수 추출
            // pyony 테이블 구조: <th>N등</th> <td>당첨자수</td> <td><a>금액</a> 원</td>
            var prizeRegex = /<th[^>]*>(\d)등<\/th>\s*<td[^>]*>([\d,]+)<\/td>\s*<td[^>]*><a[^>]*>([\d,]+)<\/a>\s*원<\/td>/g;
            var pm;
            while ((pm = prizeRegex.exec(detailHtml)) !== null) {
                var rank = parseInt(pm[1]);
                var winners = parseInt(pm[2].replace(/,/g, ''));
                var amount = parseInt(pm[3].replace(/,/g, ''));

                // 한글 금액 변환
                var amountStr = formatKoreanMoney(amount);

                if (rank === 1) {
                    rounds[i].prize = amountStr;
                    rounds[i].winners = winners;
                } else if (rank === 2) {
                    rounds[i].prize2 = amountStr;
                    rounds[i].winners2 = winners;
                } else if (rank === 3) {
                    rounds[i].prize3 = amountStr;
                    rounds[i].winners3 = winners;
                }
            }
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
            var lottoData = { lastUpdated: new Date().toISOString(), rounds: lottoResults };
            fs.writeFileSync(
                path.join(DATA_DIR, 'lotto.json'),
                JSON.stringify(lottoData, null, 4) + '\n'
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
            var pensionData = { lastUpdated: new Date().toISOString(), rounds: pensionResults };
            fs.writeFileSync(
                path.join(DATA_DIR, 'pension.json'),
                JSON.stringify(pensionData, null, 4) + '\n'
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

    // 파싱 실패 감지
    var hasFailure = false;
    try {
        var lottoCheck = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lotto.json'), 'utf8'));
        if (!lottoCheck.rounds || lottoCheck.rounds.length === 0) hasFailure = true;
    } catch (e) { hasFailure = true; }
    try {
        var pensionCheck = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pension.json'), 'utf8'));
        if (!pensionCheck.rounds || pensionCheck.rounds.length === 0) hasFailure = true;
    } catch (e) { hasFailure = true; }

    if (hasFailure) {
        console.error('\n⚠️  경고: 일부 데이터 수집에 실패했습니다. 소스 사이트 구조가 변경되었을 수 있습니다.');
        process.exitCode = 1;
    }

    console.log('=== 완료 ===');
}

main().catch(function(e) {
    console.error('치명적 오류:', e);
    process.exit(1);
});
