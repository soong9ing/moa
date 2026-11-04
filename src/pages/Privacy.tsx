import { Logo } from '../components/Shell'
import { Icon } from '../lib/icons'
import { Link } from '../lib/router'

/** 개인정보 처리 안내 — 무엇을 받고, 어디에 쓰고, 어떻게 지우는지 */
export function Privacy() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" aria-label="Moa 처음 화면으로">
          <Logo />
        </Link>
      </header>

      <article className="privacy">
        <button type="button" className="back-link" onClick={() => window.history.back()}>
          <Icon name="back" size={18} /> 뒤로
        </button>
        <h1>개인정보 처리 안내</h1>
        <p className="sub">Moa는 개인이 운영하는 취향 궁합 서비스예요. 꼭 필요한 정보만 받고, 다른 가입자에게 공개하지 않아요.</p>

        <section>
          <h2>받는 정보</h2>
          <ul>
            <li>
              <b>가입할 때:</b> 이메일, 비밀번호, 닉네임. 비밀번호는 암호화되어 저장되고 운영자도 볼 수 없어요.
            </li>
            <li>
              <b>프로필을 저장할 때:</b> 나이, 키, 자기소개, 성별, 성격·취미·음악·여행 취향, 스타일, 찾는 상대 조건.
            </li>
            <li>
              <b>고르지 않아도 되는 정보:</b> 종교, 소득 구간. 입력하지 않아도 서비스를 이용할 수 있어요.
            </li>
          </ul>
        </section>

        <section>
          <h2>쓰는 곳</h2>
          <ul>
            <li>나와 취향이 맞는 상대를 계산해 추천하는 데만 써요.</li>
            <li>첫 화면의 "현재 가입자 수"에는 숫자 하나만 쓰이고, 누가 가입했는지는 보이지 않아요.</li>
            <li>광고나 다른 서비스에 넘기지 않아요.</li>
          </ul>
        </section>

        <section>
          <h2>보관 장소와 공개 범위</h2>
          <ul>
            <li>계정과 프로필은 Supabase(서울 지역 서버)에 저장돼요.</li>
            <li>내 프로필은 나만 볼 수 있어요. 다른 가입자에게 공개되지 않아요.</li>
            <li>좋아요, 대화, 차단 기록은 서버로 보내지 않고 지금 쓰는 브라우저에만 저장돼요.</li>
          </ul>
        </section>

        <section>
          <h2>추천 상대와 대화</h2>
          <p>지금 추천해 드리는 상대는 모두 Moa가 만든 캐릭터예요. 대화는 캐릭터의 자동 답장으로 이어지고, 실제 사람에게 전달되지 않아요.</p>
        </section>

        <section>
          <h2>삭제와 탈퇴</h2>
          <ul>
            <li>
              <b>내 프로필 → 회원 탈퇴</b>를 누르면 계정과 프로필이 서버에서 바로 지워져요.
            </li>
            <li>Moa는 만 19세 이상만 이용할 수 있어요.</li>
          </ul>
        </section>
      </article>
    </div>
  )
}
