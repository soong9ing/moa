import { useState, type ReactNode } from 'react'
import { Avatar, KindBadge } from '../components/visuals'
import {
  GENDERS,
  HOBBIES,
  INCOME_BANDS,
  MAX_AGE,
  MIN_AGE,
  MUSIC_GENRES,
  PERSONALITIES,
  RELIGIONS,
  STYLE_TAGS,
  TRAVEL_STYLES,
} from '../data/options'
import { findMockProfile } from '../data/mockProfiles'
import { Icon } from '../lib/icons'
import { navigate } from '../lib/router'
import { DEFAULT_SCORE_TABLE, getActiveFilters, ruleMax, type ScoreKey } from '../matching'
import { useApp } from '../store/AppStore'
import type { Preferences, Profile } from '../types'

type Draft = Omit<Profile, 'id' | 'kind'>

/** 여러 개 고르는 칩 */
function MultiChips<T extends string>({ options, value, onChange, max }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; max?: number }) {
  return (
    <div className="chips" role="group">
      {options.map((o) => {
        const on = value.includes(o)
        const disabled = !on && max != null && value.length >= max
        return (
          <button
            type="button"
            key={o}
            className={`chip-btn${on ? ' is-on' : ''}`}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
          >
            {on && <Icon name="check" size={14} />}
            {o}
          </button>
        )
      })}
    </div>
  )
}

/** 하나만 고르는 칩 (다시 누르면 선택 해제 = 미설정) */
function SingleChips<T extends string>({ options, value, onChange, noneLabel }: { options: readonly T[]; value: T | null; onChange: (v: T | null) => void; noneLabel: string }) {
  return (
    <div className="chips" role="radiogroup">
      <button type="button" role="radio" aria-checked={value == null} className={`chip-btn is-none${value == null ? ' is-on' : ''}`} onClick={() => onChange(null)}>
        {noneLabel}
      </button>
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={value === o} key={o} className={`chip-btn${value === o ? ' is-on' : ''}`} onClick={() => onChange(value === o ? null : o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`toggle${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  )
}

function Section({ title, hint, children, id }: { title: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="card form-card" id={id}>
      <header>
        <h2>{title}</h2>
        {hint && <p className="hint">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

function Row({ label, score, children, note }: { label: string; score?: ScoreKey; children: ReactNode; note?: string }) {
  return (
    <div className="row">
      <div className="row-label">
        <span>{label}</span>
        {score && <em className="score-tag">점수 {ruleMax(DEFAULT_SCORE_TABLE[score])}점</em>}
      </div>
      {children}
      {note && <p className="row-note">{note}</p>}
    </div>
  )
}

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s))

export function ProfilePage() {
  const { user, profile, prefs: savedPrefs, saveProfile, savePrefs, notify, resetMyData, blocked, unblockProfile } = useApp()
  const [draft, setDraft] = useState<Draft>(() =>
    profile
      ? { ...profile }
      : {
          nickname: user?.nickname ?? '',
          age: 27,
          height: 168,
          bio: '',
          gender: null,
          personality: [],
          hobbies: [],
          music: [],
          travel: null,
          styles: [],
          religion: null,
          income: null,
          tagline: '',
        },
  )
  const [prefs, setPrefs] = useState<Preferences>(savedPrefs)
  const [errors, setErrors] = useState<string[]>([])
  const [confirmReset, setConfirmReset] = useState(false)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setP = <K extends keyof Preferences>(k: K, v: Preferences[K]) => setPrefs((p) => ({ ...p, [k]: v }))

  const validate = (): string[] => {
    const e: string[] = []
    if (!draft.nickname.trim()) e.push('닉네임을 입력해 주세요.')
    if (!Number.isInteger(draft.age) || draft.age < MIN_AGE || draft.age > MAX_AGE) e.push(`나이는 ${MIN_AGE}~${MAX_AGE}세 사이로 입력해 주세요. (성인만 이용할 수 있어요)`)
    if (!Number.isFinite(draft.height) || draft.height < 140 || draft.height > 220) e.push('키는 140~220cm 사이로 입력해 주세요.')
    if (draft.bio.length > 200) e.push('자기소개는 200자 이내로 써 주세요.')
    const bad = (n: number | null, lo: number, hi: number) => n != null && (!Number.isFinite(n) || n < lo || n > hi)
    if (bad(prefs.ageMin, MIN_AGE, MAX_AGE) || bad(prefs.ageMax, MIN_AGE, MAX_AGE)) e.push(`선호 나이는 ${MIN_AGE}~${MAX_AGE}세 사이로 입력해 주세요.`)
    if (prefs.ageMin != null && prefs.ageMax != null && prefs.ageMin > prefs.ageMax) e.push('선호 나이의 최소값이 최대값보다 커요.')
    if (bad(prefs.heightMin, 140, 220) || bad(prefs.heightMax, 140, 220)) e.push('선호 키는 140~220cm 사이로 입력해 주세요.')
    if (prefs.heightMin != null && prefs.heightMax != null && prefs.heightMin > prefs.heightMax) e.push('선호 키의 최소값이 최대값보다 커요.')
    return e
  }

  const onSave = (goFeed: boolean) => {
    const e = validate()
    setErrors(e)
    if (e.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    saveProfile({ ...draft, nickname: draft.nickname.trim(), bio: draft.bio.trim(), tagline: draft.tagline?.trim() })
    savePrefs(prefs)
    notify(profile ? '프로필을 수정했어요' : '프로필을 등록했어요')
    if (goFeed) navigate('/feed')
  }

  // 미리보기: 지금 입력으로 점수에 쓰이는 항목 / 실제 적용될 필수 필터
  const usedScore: Record<ScoreKey, boolean> = {
    age: prefs.ageMin != null || prefs.ageMax != null,
    personality: draft.personality.length > 0,
    hobbies: draft.hobbies.length > 0,
    music: draft.music.length > 0,
    travel: draft.travel != null,
    religion: prefs.religion != null,
    style: prefs.styleTags.length > 0,
  }
  const previewMe: Profile = { ...draft, id: user?.id ?? 'me', kind: 'user' }
  const active = getActiveFilters(previewMe, prefs)
  const maxPossible = (Object.keys(usedScore) as ScoreKey[]).reduce((s, k) => s + (usedScore[k] ? ruleMax(DEFAULT_SCORE_TABLE[k]) : 0), 0)

  return (
    <div className="page profile-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{profile ? '프로필 수정' : '프로필 등록'}</p>
          <h1>내 취향 모으기</h1>
          <p className="sub">고르지 않은 항목은 점수에도, 필터에도 쓰이지 않아요. 필요한 것만 골라도 괜찮아요.</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="notice notice-error" role="alert">
          <Icon name="alert" size={18} />
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="profile-grid">
        <div className="profile-forms">
          <Section title="기본 정보">
            <div className="basic">
              <Avatar profile={{ id: user?.id ?? 'me', nickname: draft.nickname || '?', kind: 'user' }} size={72} />
              <div className="basic-fields">
                <label className="field">
                  <span>닉네임 *</span>
                  <input maxLength={12} value={draft.nickname} onChange={(e) => set('nickname', e.target.value)} />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>나이 *</span>
                    <input type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} value={Number.isFinite(draft.age) ? draft.age : ''} onChange={(e) => set('age', Number(e.target.value))} />
                  </label>
                  <label className="field">
                    <span>키 (cm) *</span>
                    <input type="number" inputMode="numeric" min={140} max={220} value={Number.isFinite(draft.height) ? draft.height : ''} onChange={(e) => set('height', Number(e.target.value))} />
                  </label>
                </div>
              </div>
            </div>
            <label className="field">
              <span>한 줄 소개</span>
              <input maxLength={24} placeholder="예: 주말엔 카메라 들고 산책" value={draft.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} />
            </label>
            <label className="field">
              <span>
                자기소개 <small className="muted">{draft.bio.length}/200</small>
              </span>
              <textarea rows={4} maxLength={200} placeholder="좋아하는 것, 요즘 빠져 있는 것, 함께 하고 싶은 것을 적어 보세요." value={draft.bio} onChange={(e) => set('bio', e.target.value)} />
            </label>
            <Row label="성별">
              <SingleChips options={GENDERS} value={draft.gender} onChange={(v) => set('gender', v)} noneLabel="밝히지 않음" />
            </Row>
          </Section>

          <Section title="나의 취향" hint="상대와 겹치는 만큼 점수가 올라가요.">
            <Row label="성격" score="personality" note={`겹치는 성격 하나당 ${DEFAULT_SCORE_TABLE.personality.type === 'perItem' ? DEFAULT_SCORE_TABLE.personality.perItem : 0}점`}>
              <MultiChips options={PERSONALITIES} value={draft.personality} onChange={(v) => set('personality', v)} />
            </Row>
            <Row label="관심사 · 취미" score="hobbies">
              <MultiChips options={HOBBIES} value={draft.hobbies} onChange={(v) => set('hobbies', v)} />
            </Row>
            <Row label="음악" score="music">
              <MultiChips options={MUSIC_GENRES} value={draft.music} onChange={(v) => set('music', v)} />
            </Row>
            <Row label="여행 스타일" score="travel">
              <SingleChips options={TRAVEL_STYLES} value={draft.travel} onChange={(v) => set('travel', v)} noneLabel="선택 안 함" />
            </Row>
          </Section>

          <Section title="선택 정보" hint="모두 선택 사항이에요. 상대가 이 정보로 필터를 걸 수 있어요.">
            <Row label="나의 스타일">
              <MultiChips options={STYLE_TAGS} value={draft.styles} onChange={(v) => set('styles', v)} max={3} />
            </Row>
            <Row label="종교">
              <SingleChips options={RELIGIONS} value={draft.religion} onChange={(v) => set('religion', v)} noneLabel="밝히지 않음" />
            </Row>
            <Row label="소득 구간">
              <SingleChips options={INCOME_BANDS} value={draft.income} onChange={(v) => set('income', v)} noneLabel="비공개" />
            </Row>
          </Section>

          <Section
            id="prefs"
            title="찾는 상대"
            hint={
              <>
                <b>선호</b>는 점수에, <b>필수</b> 토글을 켠 조건은 필터(제외)에 쓰여요.
              </>
            }
          >
            <Row label="상대 성별" note="고르면 해당 성별만 추천해요 (필터).">
              <SingleChips options={GENDERS} value={prefs.gender} onChange={(v) => setP('gender', v)} noneLabel="상관없음" />
            </Row>

            <Row label="선호 나이" score="age">
              <div className="range">
                <input type="number" inputMode="numeric" placeholder="최소" aria-label="선호 나이 최소" value={prefs.ageMin ?? ''} onChange={(e) => setP('ageMin', numOrNull(e.target.value))} />
                <span>~</span>
                <input type="number" inputMode="numeric" placeholder="최대" aria-label="선호 나이 최대" value={prefs.ageMax ?? ''} onChange={(e) => setP('ageMax', numOrNull(e.target.value))} />
                <span>세</span>
              </div>
              <Toggle
                checked={prefs.ageRequired}
                disabled={prefs.ageMin == null && prefs.ageMax == null}
                onChange={(v) => setP('ageRequired', v)}
                label="필수 — 범위 밖이면 추천에서 제외"
              />
            </Row>

            <Row label="선호 키" note="키는 점수표에 없어서 필수로 켤 때만 쓰여요.">
              <div className="range">
                <input type="number" inputMode="numeric" placeholder="최소" aria-label="선호 키 최소" value={prefs.heightMin ?? ''} onChange={(e) => setP('heightMin', numOrNull(e.target.value))} />
                <span>~</span>
                <input type="number" inputMode="numeric" placeholder="최대" aria-label="선호 키 최대" value={prefs.heightMax ?? ''} onChange={(e) => setP('heightMax', numOrNull(e.target.value))} />
                <span>cm</span>
              </div>
              <Toggle
                checked={prefs.heightRequired}
                disabled={prefs.heightMin == null && prefs.heightMax == null}
                onChange={(v) => setP('heightRequired', v)}
                label="필수 — 범위 밖이면 추천에서 제외"
              />
            </Row>

            <Row label="선호 종교" score="religion">
              <SingleChips options={RELIGIONS} value={prefs.religion} onChange={(v) => setP('religion', v)} noneLabel="상관없음" />
              <Toggle checked={prefs.religionRequired} disabled={prefs.religion == null} onChange={(v) => setP('religionRequired', v)} label="필수 — 다르면 추천에서 제외" />
            </Row>

            <Row label="바라는 스타일" score="style" note="하나라도 겹치면 5점이에요.">
              <MultiChips options={STYLE_TAGS} value={prefs.styleTags} onChange={(v) => setP('styleTags', v)} />
            </Row>

            <Row label="소득 구간" note="고른 구간만 추천해요 (필터). 아무것도 고르지 않으면 상관없음이에요.">
              <MultiChips options={INCOME_BANDS} value={prefs.incomeBands} onChange={(v) => setP('incomeBands', v)} />
            </Row>

            <Row label="여행 취향">
              <Toggle
                checked={prefs.travelRequired}
                disabled={draft.travel == null}
                onChange={(v) => setP('travelRequired', v)}
                label={draft.travel ? `필수 — 나와 같은 ${draft.travel}만 추천` : '내 여행 스타일을 먼저 골라 주세요'}
              />
            </Row>
          </Section>
          {blocked.length > 0 && (
            <Section title="차단한 사람" hint="차단한 사람은 추천, 좋아요, 대화 목록에 나오지 않아요.">
              <ul className="blocked-list">
                {blocked.map((bid) => {
                  const bp = findMockProfile(bid)
                  if (!bp) return null
                  return (
                    <li key={bid}>
                      <Avatar profile={bp} size={36} />
                      <span>
                        <strong>{bp.nickname}</strong>
                        <small className="muted">{bp.age}세</small>
                      </span>
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        onClick={() => {
                          unblockProfile(bid)
                          notify(`${bp.nickname}님 차단을 풀었어요`)
                        }}
                      >
                        차단 풀기
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
        </div>

        <aside className="profile-aside">
          <div className="card sticky">
            <div className="aside-me">
              <Avatar profile={{ id: user?.id ?? 'me', nickname: draft.nickname || '?', kind: 'user' }} size={44} />
              <div>
                <strong>{draft.nickname || '닉네임'}</strong>
                <KindBadge kind="user" />
              </div>
            </div>

            <h3>점수에 쓰이는 항목</h3>
            <ul className="usage">
              {(Object.keys(usedScore) as ScoreKey[]).map((k) => (
                <li key={k} className={usedScore[k] ? 'is-on' : ''}>
                  <Icon name={usedScore[k] ? 'check' : 'close'} size={14} />
                  <span>{DEFAULT_SCORE_TABLE[k].label}</span>
                  <b>{ruleMax(DEFAULT_SCORE_TABLE[k])}</b>
                </li>
              ))}
            </ul>
            <p className="usage-sum">
              받을 수 있는 최대 점수 <b>{maxPossible}</b> / 100
            </p>

            <h3>적용될 필수 필터</h3>
            {active.length === 0 ? (
              <p className="muted small">없음 — 모든 사람이 후보가 돼요.</p>
            ) : (
              <ul className="filters-mini">
                {active.map((f) => (
                  <li key={f.key}>
                    <Icon name="filter" size={14} />
                    {f.label}: {f.condition}
                  </li>
                ))}
              </ul>
            )}
            {prefs.ageRequired && prefs.ageMin == null && prefs.ageMax == null && <p className="muted small">나이 범위가 비어 있어 나이 필터는 적용되지 않아요.</p>}

            <div className="aside-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={() => onSave(true)}>
                저장하고 추천 보기
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => onSave(false)}>
                저장만 하기
              </button>
            </div>
          </div>
          {profile &&
            (confirmReset ? (
              <div className="reset-confirm" role="alertdialog" aria-label="내 데이터 초기화 확인">
                <p>이 기기에 저장된 내 프로필·좋아요·대화를 모두 지울까요?</p>
                <div>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={() => {
                      resetMyData()
                      setConfirmReset(false)
                      notify('내 데이터를 초기화했어요')
                      navigate('/feed')
                    }}
                  >
                    모두 지우기
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmReset(false)}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="text-btn danger small" onClick={() => setConfirmReset(true)}>
                내 데이터 초기화
              </button>
            ))}
        </aside>
      </div>

      <div className="savebar">
        <button type="button" className="btn btn-ghost" onClick={() => onSave(false)}>
          저장
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onSave(true)}>
          저장하고 추천 보기
        </button>
      </div>
    </div>
  )
}
