import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'

const ROOMS = ['미래창작공방', '에듀테크 교육실']
const HOURS = Array.from({ length: 10 }, (_, i) => String(i + 8).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const ROOM_ACCENTS = {
  '미래창작공방':
    'bg-blue-500/90 hover:bg-blue-500 text-white border border-blue-300/50 shadow-lg shadow-blue-500/20',
  '에듀테크 교육실':
    'bg-emerald-500/90 hover:bg-emerald-500 text-white border border-emerald-300/50 shadow-lg shadow-emerald-500/20',
}

const ROOM_BADGE_CLASS = {
  '미래창작공방': 'bg-blue-100/80 text-blue-700 border border-blue-200/70',
  '에듀테크 교육실': 'bg-emerald-100/80 text-emerald-700 border border-emerald-200/70',
}

const INPUT_CLASS =
  'w-full rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 hover:bg-white/70 transition-colors duration-200'

const GLASS_BUTTON_CLASS =
  'w-full rounded-2xl bg-white/50 hover:bg-white/70 backdrop-blur-sm border border-white/60 px-4 py-3 text-gray-800 font-medium shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [view, setView] = useState('home')
  const [selectedRoom, setSelectedRoom] = useState(null)

  const [teacherName, setTeacherName] = useState('')
  const [date, setDate] = useState('')
  const [startHour, setStartHour] = useState(HOURS[0])
  const [startMinute, setStartMinute] = useState(MINUTES[0])
  const [endHour, setEndHour] = useState(HOURS[0])
  const [endMinute, setEndMinute] = useState(MINUTES[0])
  const [loading, setLoading] = useState(false)

  const [reservations, setReservations] = useState(null)
  const [myLoading, setMyLoading] = useState(false)
  const [cancelingId, setCancelingId] = useState(null)

  const [allReservations, setAllReservations] = useState([])
  const [allLoading, setAllLoading] = useState(false)
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      alert(err.message)
    }
  }

  const goHome = () => {
    setSelectedRoom(null)
    setView('home')
  }

  const openBooking = (room) => {
    setSelectedRoom(room)
    setTeacherName(user.displayName || '')
    setView('booking')
  }

  const openMyReservations = () => {
    setView('myReservations')
    fetchMyReservations()
  }

  const openAllReservations = () => {
    setFilterDate('')
    setView('allReservations')
    fetchAllReservations()
  }

  const fetchAllReservations = async () => {
    setAllLoading(true)
    try {
      const q = query(collection(db, 'reservations'), where('status', '==', 'active'))
      const snapshot = await getDocs(q)
      const list = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      setAllReservations(list)
    } catch (err) {
      alert(err.message)
    } finally {
      setAllLoading(false)
    }
  }

  const fetchMyReservations = async () => {
    setMyLoading(true)
    try {
      const q = query(
        collection(db, 'reservations'),
        where('ownerId', '==', user.uid),
        where('status', '==', 'active'),
      )
      const snapshot = await getDocs(q)
      const list = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setReservations(list)
    } catch (err) {
      alert(err.message)
    } finally {
      setMyLoading(false)
    }
  }

  const handleCancel = async (id) => {
    if (!confirm('예약을 취소하시겠습니까?')) return
    setCancelingId(id)
    try {
      await deleteDoc(doc(db, 'reservations', id))
      await fetchMyReservations()
    } catch (err) {
      alert(err.message)
    } finally {
      setCancelingId(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const startTime = `${startHour}:${startMinute}`
    const endTime = `${endHour}:${endMinute}`

    if (endTime <= startTime) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.')
      return
    }

    setLoading(true)
    try {
      const q = query(
        collection(db, 'reservations'),
        where('room', '==', selectedRoom),
        where('date', '==', date),
      )
      const snapshot = await getDocs(q)
      const hasOverlap = snapshot.docs.some((docSnap) => {
        const data = docSnap.data()
        if (data.status !== 'active') return false
        return data.startTime < endTime && data.endTime > startTime
      })

      if (hasOverlap) {
        alert('해당 시간에 이미 다른 예약이 있습니다.')
        return
      }

      await runTransaction(db, async (transaction) => {
        const newDocRef = doc(collection(db, 'reservations'))
        transaction.set(newDocRef, {
          ownerId: user.uid,
          teacherName,
          room: selectedRoom,
          date,
          startTime,
          endTime,
          createdAt: serverTimestamp(),
          status: 'active',
        })
      })

      alert('예약이 완료되었습니다.')
      goHome()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const visibleAllReservations = filterDate
    ? allReservations.filter((item) => item.date === filterDate)
    : allReservations

  if (authLoading) {
    return (
      <div className="aurora-bg min-h-screen w-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/40 bg-white/30 p-8 text-center shadow-2xl shadow-indigo-900/10 backdrop-blur-xl">
          <p className="text-sm font-medium text-gray-700">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="aurora-bg min-h-screen w-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/40 bg-white/30 p-8 text-center shadow-2xl shadow-indigo-900/10 backdrop-blur-xl">
          <h1 className="mb-6 text-2xl font-semibold text-gray-900">특별실 예약 시스템</h1>
          <button type="button" onClick={handleGoogleSignIn} className={GLASS_BUTTON_CLASS}>
            Google로 로그인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="aurora-bg min-h-screen w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/40 bg-white/30 p-8 shadow-2xl shadow-indigo-900/10 backdrop-blur-xl">
        {view === 'home' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end gap-2">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full border border-white/60"
                />
              )}
              <span className="text-sm font-medium text-gray-700">{user.displayName}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-white/60 bg-white/50 px-2.5 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm transition-colors duration-200 hover:bg-white/70"
              >
                로그아웃
              </button>
            </div>
            <h1 className="mb-2 text-center text-2xl font-semibold text-gray-900">
              특별실 예약 시스템
            </h1>
            {ROOMS.map((room) => (
              <button
                key={room}
                type="button"
                onClick={() => openBooking(room)}
                className={`w-full rounded-2xl px-4 py-3 font-medium transition-colors duration-200 ${ROOM_ACCENTS[room]}`}
              >
                {room}
              </button>
            ))}
            <button type="button" onClick={openAllReservations} className={GLASS_BUTTON_CLASS}>
              전체 예약 현황 보기
            </button>
            <button type="button" onClick={openMyReservations} className={GLASS_BUTTON_CLASS}>
              내 예약 조회 및 취소
            </button>
          </div>
        )}

        {view === 'booking' && (
          <div>
            <button
              type="button"
              onClick={goHome}
              className="mb-6 text-sm font-medium text-gray-600 transition-colors duration-200 hover:text-gray-900"
            >
              ← 홈으로
            </button>
            <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">
              예약 신청 {selectedRoom ? `- ${selectedRoom}` : ''}
            </h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  신청 교사명
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  required
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  사용 날짜
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    시작 시간
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h}시
                        </option>
                      ))}
                    </select>
                    <select
                      value={startMinute}
                      onChange={(e) => setStartMinute(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>
                          {m}분
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    종료 시간
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h}시
                        </option>
                      ))}
                    </select>
                    <select
                      value={endMinute}
                      onChange={(e) => setEndMinute(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>
                          {m}분
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={loading} className={GLASS_BUTTON_CLASS}>
                {loading ? '처리 중...' : '예약 신청하기'}
              </button>
            </form>
          </div>
        )}

        {view === 'myReservations' && (
          <div>
            <button
              type="button"
              onClick={goHome}
              className="mb-6 text-sm font-medium text-gray-600 transition-colors duration-200 hover:text-gray-900"
            >
              ← 홈으로
            </button>
            <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">
              내 예약 조회 및 취소
            </h1>

            {myLoading && <p className="text-center text-sm text-gray-600">불러오는 중...</p>}

            {!myLoading && reservations !== null && reservations.length === 0 && (
              <p className="text-center text-sm text-gray-600">예약된 내역이 없습니다.</p>
            )}

            {!myLoading && reservations !== null && reservations.length > 0 && (
              <ul className="flex flex-col gap-3">
                {reservations.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1 rounded-2xl border border-white/50 bg-white/40 p-4 text-left shadow-sm backdrop-blur-sm"
                  >
                    <p className="font-medium text-gray-900">{item.room}</p>
                    <p className="text-sm text-gray-600">
                      {item.date} {item.startTime}~{item.endTime}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCancel(item.id)}
                      disabled={cancelingId === item.id}
                      className="mt-2 self-start rounded-xl border border-white/60 bg-white/50 px-3 py-1.5 text-sm font-medium text-red-600 backdrop-blur-sm transition-colors duration-200 hover:bg-red-50/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cancelingId === item.id ? '취소 중...' : '예약 취소'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view === 'allReservations' && (
          <div>
            <button
              type="button"
              onClick={goHome}
              className="mb-6 text-sm font-medium text-gray-600 transition-colors duration-200 hover:text-gray-900"
            >
              ← 홈으로
            </button>
            <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">
              전체 예약 현황
            </h1>

            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-gray-700">날짜 선택</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            {allLoading && (
              <p className="text-center text-sm text-gray-600">불러오는 중...</p>
            )}

            {!allLoading && visibleAllReservations.length === 0 && (
              <p className="text-center text-sm text-gray-600">등록된 예약이 없습니다.</p>
            )}

            {!allLoading && visibleAllReservations.length > 0 && (
              <ul className="flex flex-col gap-3">
                {visibleAllReservations.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1 rounded-2xl border border-white/50 bg-white/40 p-4 text-left shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{item.date}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROOM_BADGE_CLASS[item.room]}`}
                      >
                        {item.room}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {item.startTime}~{item.endTime}
                    </p>
                    <p className="text-sm text-gray-600">{item.teacherName}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
