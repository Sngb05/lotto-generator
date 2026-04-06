# plasmalotto                                                                                                                        
                                                                                                                                       
  > 로또 6/45와 연금복권 720+ 번호를 무료로 랜덤 생성하는 웹 도구                                                                      
                                                                                                                                       
  🌐 **라이브 사이트:** https://www.plasmalotto.com                                                                                 

  ![Uploading 1.png…]()


  ## 소개

  plasmalotto는 한국 복권의 두 가지 추첨식 게임(**로또 6/45**, **연금복권 720+**) 번호를 무료로 생성할 수 있는 웹사이트입니다. 회원가입
   없이 즉시 사용할 수 있으며, 모바일 환경에 최적화되어 있습니다.

  광고성 표현이나 검증되지 않은 통계는 사용하지 않으며, 사실 위주의 절제된 정보를 제공하는 것을 원칙으로 합니다.

  ## 주요 기능

  - **로또 6/45 번호 생성** — 1~45 사이 6개 번호를 1~5게임 동시 생성
  - **연금복권 720+ 번호 생성** — 1~5조 + 6자리 번호 생성
  - **최근 회차 당첨번호 + 등수별 당첨금** — 매주 자동 갱신
  - **회차별 당첨번호 DB** — 1회(2002-12-07)부터 최신 회차까지 1,218회 검색 가능
  - **이번 주 추첨 번호** — 다음 회차 시드 기반 결정적 PRNG로 5게임 표시
  - **실시간 구매 마감 카운트다운** — 토요일 20:00 / 목요일 19:00 마감
  - **5구간 균형 분포 시각 라벨** — 5게임 생성 시 가장 균등한 1게임에 표시 (당첨 주장 X, 시각 정보)

  <img width="537" height="794" alt="2" src="https://github.com/user-attachments/assets/421776b5-2044-4005-bccc-dece79e85cda" />

  ## 기술적 특징

  - **암호학적 난수 생성기** — `crypto.getRandomValues()` 사용 (`Math.random()` 미사용)
  - **모듈로 바이어스 제거** — Rejection sampling 기법으로 균일 분포 보장
  - **6종 JSON-LD 구조화 데이터** — `WebSite`, `WebApplication`, `Organization`, `BreadcrumbList`, `HowTo`, `FAQPage`
  - **GitHub Actions 자동화** — 매주 토요일/목요일 추첨 직후 당첨번호 자동 수집·갱신
  - **순수 정적 사이트** — 빌드 도구·프레임워크 없음. Vercel 자동 배포

  ## 기술 스택

  | 영역 | 사용 기술 |
  |---|---|
  | Frontend | Vanilla HTML5 + CSS3 + JavaScript (프레임워크 없음) |
  | Hosting | Vercel (정적 호스팅 + 자동 배포) |
  | Data Source | 동행복권 공식 통계 (superkts.com / pyony.com 경유) |
  | Automation | GitHub Actions (cron schedule) |
  | SEO | JSON-LD 구조화 데이터 6종 + sitemap.xml + robots.txt |

  ## 페이지 구성

  | 페이지 | URL | 설명 |
  |---|---|---|
  | 메인 | [plasmalotto.com](https://www.plasmalotto.com/) | 번호 생성기 + 최근 당첨번호 |
  | 소개 | [/about.html](https://www.plasmalotto.com/about.html) | 사이트 소개와 운영 원칙 |
  | 복권 종류 | [/lottery-types.html](https://www.plasmalotto.com/lottery-types.html) | 한국 복권 3종 비교 (로또/연금복권/스피또) |
  | 회차별 당첨번호 | [/winning-history.html](https://www.plasmalotto.com/winning-history.html) | 1회~최신 회차 1,218회 검색 |
  | 이번 주 추첨 번호 | [/weekly-numbers.html](https://www.plasmalotto.com/weekly-numbers.html) | 다음 회차 무작위 5게임 |
  | 개인정보 | [/privacy.html](https://www.plasmalotto.com/privacy.html) | 개인정보처리방침 |
  | 문의 | [/contact.html](https://www.plasmalotto.com/contact.html) | 문의 폼 |

  ## 자동화 흐름

  ```
  [매주 토요일 21:30 KST]
    → GitHub Actions 트리거
    → scripts/update-lotto.js 실행
    → 당첨번호 자동 수집 (최근 회차 + history 누적)
    → data/lotto.json + data/lotto-history.json 갱신
    → github-actions[bot] 자동 commit + push
    → Vercel 자동 배포
    → 사이트에 새 회차 자동 반영
  ```

  수동 개입 없이 매주 새 회차가 자동으로 사이트에 반영됩니다.

  ## 면책

  본 사이트에서 생성한 번호로 인한 당첨 여부에 대해 어떠한 보장도 하지 않습니다. 모든 무작위 추첨 번호의 1등 당첨 확률은 1/8,145,060로
  동일하며, 본 사이트는 단순히 번호 선택을 보조하는 도구입니다. 본 사이트는 동행복권과 무관한 개인 운영 사이트이며, 복권 구매는
  [동행복권 공식 사이트](https://www.dhlottery.co.kr)를 이용해주세요.

  ## 라이선스

  개인 사용 무료. 코드 일부 참고는 자유.

  ---
  이미지 추가하는 방법 (가장 쉬운 방식)

  GitHub 웹사이트에서 README.md 편집하면 이미지를 드래그&드롭으로 즉시 업로드할 수 있어요. URL이 자동 생성돼요.

  단계

  1. https://github.com/Sngb05/lotto-generator 접속
  2. README.md 파일 클릭 (없으면 "Add file" → "Create new file" → 파일명 README.md)
  3. 우상단 연필 아이콘 (편집)
  4. 위 마크다운 본문 전체 복붙
  5. 여기에-스크린샷-1-URL 부분을 마우스로 선택해서 지우고, 그 자리에 이미지 파일을 드래그&드롭
  6. GitHub가 자동으로 ![image](https://github.com/user-attachments/...) 형식으로 변환해줌
  7. 두 번째 이미지도 같은 방식으로
  8. 페이지 하단 "Commit changes" 클릭
  9. 끝

  주의 한 가지

  드래그&드롭으로 올라간 이미지는 GitHub user-attachments 도메인에 호스팅돼요. 영구적이고 안정적이라 안심해도 돼요. 별도 이미지 호스팅
  사이트 필요 없음.
