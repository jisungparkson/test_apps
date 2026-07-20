import { useState } from 'react'
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
import { db } from './firebase'

const ROOMS = ['미래창작공방', '에듀테크 교육실']
const HOURS = Array.from({ length: 10 }, (_, i) => String(i + 8).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const ROOM_ACCENTS = {
  '미래창작공방':
    'bg-blue-500/90 hover:bg-blue-500 text-white border border-blue-300/50 shadow-lg shadow-blue-500/20',
  '에듀테크 교육실':
    'bg-emerald-500/90 hover:bg-emerald-500 text-white border border-emerald-300/50 shadow-lg shadow-emerald-500/20',
}

const INPUT_CLASS =
  'w-full rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 hover:bg-white/70 transition-colors duration-200'

const GLASS_BUTTON_CLASS =
  'w-full rounded-2xl bg-white/50 hover:bg-white/70 backdrop-blur-sm border border-white/60 px-4 py-3 text-gray-800 font-medium shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

function App() {
  const [view, setView] = useState('home')
  const [selectedRoom, setSelectedRoom] = useState(null)

  const [teacherName, setTeacherName] = useState('')
  const [date, setDate] = useState('')
  const [startHour, setStartHour] = useState(HOURS[0])
  const [startMinute, setStartMinute] = useState(MINUTES[0])
  const [endHour, setEndHour] = useState(HOURS[0])
  const [endMinute, setEndMinute] = useState(MINUTES[0])
  const [loading, setLoading] = useState(false)

  const [searchName, setSearchName] = useState('')
  const [reservations, setReservations] = useState(null)
  const [searching, setSearching] = useState(false)
  const [cancelingId, setCancelingId] = useState(null)

  const goHome = () => {
    setSelectedRoom(null)
    setView('home')
  }

  const openBooking = (room) => {
    setSelectedRoom(room)
    setView('booking')
  }

  const handleSearch = async (e) => {
    e?.preventDefault()
    setSearching(true)
    try {
      const q = query(
        collection(db, 'reservations'),
        where('ownerId', '==', 'test-user'),
        where('status', '==', 'active'),
      )
      const snapshot = await getDocs(q)
      const keyword = searchName.replace(/\s/g, '')
      const filtered = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((item) => item.teacherName?.replace(/\s/g, '').includes(keyword))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setReservations(filtered)
    } catch (err) {
      alert(err.message)
    } finally {
      setSearching(false)
    }
  }

  const handleCancel = async (id) => {
    if (!confirm('예약을 취소하시겠습니까?')) return
    setCancelingId(id)
    try {
      await deleteDoc(doc(db, 'reservations', id))
      await handleSearch()
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
          ownerId: 'test-user',
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

  return (
    <div className="aurora-bg min-h-screen w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/40 bg-white/30 p-8 shadow-2xl shadow-indigo-900/10 backdrop-blur-xl">
        {view === 'home' && (
          <div className="flex flex-col gap-4">
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
            <button
              type="button"
              onClick={() => setView('myReservations')}
              className={GLASS_BUTTON_CLASS}
            >
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

            <form onSubmit={handleSearch} className="mb-6 flex gap-2">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="교사 이름"
                className={INPUT_CLASS}
              />
              <button
                type="submit"
                disabled={searching}
                className="shrink-0 rounded-xl border border-white/60 bg-white/50 px-4 py-2 font-medium text-gray-800 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? '조회 중...' : '조회'}
              </button>
            </form>

            {reservations !== null && reservations.length === 0 && (
              <p className="text-center text-sm text-gray-600">예약된 내역이 없습니다.</p>
            )}

            {reservations !== null && reservations.length > 0 && (
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
      </div>
    </div>
  )
}

export default App
