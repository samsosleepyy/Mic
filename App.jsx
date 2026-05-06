import React, { useState, useEffect } from 'react';
import { Trash2, CheckCircle, Clock, AlertCircle, Plus } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// Firebase Setup
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const App = () => {
  // สร้าง State สำหรับเก็บข้อมูลการเช่า
  const [rentals, setRentals] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // State สำหรับฟอร์มเพิ่มข้อมูล
  const [formData, setFormData] = useState({
    customerName: '',
    startTime: '',
    endTime: ''
  });

  // State สำหรับเก็บเวลาปัจจุบันเพื่อใช้อัปเดตสถานะแบบ Real-time
  const [currentTime, setCurrentTime] = useState(new Date());

  // อัปเดตเวลาปัจจุบันทุกๆ 1 วินาที เพื่อเช็คสถานะหมดเวลา
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Auth Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Data from Firestore
  useEffect(() => {
    if (!user) return;

    const rentalsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'rentals');
    const unsubscribe = onSnapshot(rentalsRef, (snapshot) => {
      const fetchedRentals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // เรียงลำดับตามวันที่สร้างล่าสุด
      fetchedRentals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRentals(fetchedRentals);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.startTime || !formData.endTime) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (new Date(formData.endTime) <= new Date(formData.startTime)) {
      alert('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
      return;
    }

    if (!user) return;

    const newRental = {
      ...formData,
      isReturned: false,
      createdAt: new Date().toISOString()
    };

    try {
      const rentalsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'rentals');
      await addDoc(rentalsRef, newRental);
      
      // เคลียร์ฟอร์ม
      setFormData({
        customerName: '',
        startTime: '',
        endTime: ''
      });
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) {
      if (!user) return;
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'rentals', id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Error deleting document: ", error);
      }
    }
  };

  const handleToggleStatus = async (id) => {
    if (!user) return;
    try {
      const rentalToUpdate = rentals.find(rental => rental.id === id);
      if (!rentalToUpdate) return;
      
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'rentals', id);
      await updateDoc(docRef, { isReturned: !rentalToUpdate.isReturned });
    } catch (error) {
      console.error("Error updating document: ", error);
    }
  };

  const formatDateTime = (dateString) => {
    const options = { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('th-TH', options);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
            <Clock size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ระบบจัดการตารางเช่าสินค้า</h1>
            <p className="text-gray-500 text-sm">จัดการลูกค้า เวลาเช่า และสถานะการคืนสินค้า</p>
          </div>
        </div>

        {/* Add Form Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
            <Plus size={20} className="text-blue-500" />
            เพิ่มข้อมูลการเช่าใหม่
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อลูกค้า</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="กรอกชื่อลูกค้า..."
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">วัน-เวลาที่เริ่มเช่า</label>
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">วัน-เวลาที่สิ้นสุด</label>
              <input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                required
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition shadow-sm"
              >
                เพิ่มรายการ
              </button>
            </div>
          </form>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-semibold text-gray-600">ชื่อลูกค้า</th>
                  <th className="p-4 font-semibold text-gray-600">เริ่มเช่า</th>
                  <th className="p-4 font-semibold text-gray-600">สิ้นสุดการเช่า</th>
                  <th className="p-4 font-semibold text-gray-600">สถานะ</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        กำลังโหลดข้อมูล...
                      </div>
                    </td>
                  </tr>
                ) : rentals.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400">
                      ยังไม่มีข้อมูลการเช่า
                    </td>
                  </tr>
                ) : (
                  rentals.map((rental) => {
                    const isExpired = new Date(rental.endTime) < currentTime;
                    const needsAction = isExpired && !rental.isReturned;
                    
                    // เงื่อนไขในการเปลี่ยนสีแถวเป็นสีแดง
                    const rowClassName = needsAction 
                      ? 'bg-red-50 hover:bg-red-100 transition-colors' 
                      : rental.isReturned 
                        ? 'bg-gray-50 opacity-80 hover:bg-gray-100 transition-colors' 
                        : 'bg-white hover:bg-gray-50 transition-colors';

                    return (
                      <tr key={rental.id} className={rowClassName}>
                        <td className="p-4 font-medium text-gray-800">
                          {rental.customerName}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {formatDateTime(rental.startTime)}
                        </td>
                        <td className={`p-4 text-sm font-medium ${needsAction ? 'text-red-600' : 'text-gray-600'}`}>
                          {formatDateTime(rental.endTime)}
                        </td>
                        <td className="p-4">
                          {rental.isReturned ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                              <CheckCircle size={14} /> คืนสินค้าแล้ว
                            </span>
                          ) : needsAction ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 animate-pulse">
                              <AlertCircle size={14} /> หมดเวลาเช่า
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                              <Clock size={14} /> กำลังเช่าอยู่
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleToggleStatus(rental.id)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                rental.isReturned 
                                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  : 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
                              }`}
                            >
                              {rental.isReturned ? 'ยกเลิกการคืน' : 'รับคืนสินค้า'}
                            </button>
                            <button
                              onClick={() => handleDelete(rental.id)}
                              className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                              title="ลบข้อมูล"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
