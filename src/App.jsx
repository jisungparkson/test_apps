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

  const goHome = () => {
    setSelectedRoom(null)
    setView('home')
  }

  const openBooking = (room) => {
    setSelectedRoom(room)
    setView('booking')
  }

  const [searchName, setSearchName] = useState('')
  const [reservations, setReservations] = useState(null)
  const [searching, setSearching] = useState(false)
  const [cancelingId, setCancelingId] = useState(null)

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <h1 className="text-2xl font-semibold text-center text-gray-900 mb-2">
            특별실 예약 시스템
          </h1>
          {ROOMS.map((room) => (
            <button
              key={room}
              type="button"
              onClick={() => openBooking(room)}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 text-white font-medium hover:bg-purple-700 transition-colors"
            >
              {room}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView('myReservations')}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            내 예약 조회 및 취소
          </button>
        </div>
      )}

      {view === 'booking' && (
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={goHome}
            className="mb-6 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 홈으로
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 text-center mb-6">
            예약 신청 {selectedRoom ? `- ${selectedRoom}` : ''}
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                신청 교사명
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사용 날짜
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시작 시간
                </label>
                <div className="flex gap-2">
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  종료 시간
                </label>
                <div className="flex gap-2">
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '처리 중...' : '예약 신청하기'}
            </button>
          </form>
        </div>
      )}

      {view === 'myReservations' && (
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={goHome}
            className="mb-6 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 홈으로
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 text-center mb-6">
            내 예약 조회 및 취소
          </h1>

          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="교사 이름"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-purple-600 px-4 py-2 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? '조회 중...' : '조회'}
            </button>
          </form>

          {reservations !== null && reservations.length === 0 && (
            <p className="text-sm text-gray-500 text-center">
              예약된 내역이 없습니다.
            </p>
          )}

          {reservations !== null && reservations.length > 0 && (
            <ul className="flex flex-col gap-3">
              {reservations.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-300 p-4 text-left flex flex-col gap-1"
                >
                  <p className="font-medium text-gray-900">{item.room}</p>
                  <p className="text-sm text-gray-600">
                    {item.date} {item.startTime}~{item.endTime}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCancel(item.id)}
                    disabled={cancelingId === item.id}
                    className="self-start mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  )
}

export default App
