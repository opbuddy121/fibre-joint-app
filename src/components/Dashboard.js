import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import CheckOut from './CheckOut';
import './Dashboard.css';

function Dashboard() {
  const [location, setLocation] = useState(null);
  const [postcode, setPostcode] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const user = auth.currentUser;

  // Function to get postcode from coordinates
  const getPostcodeFromCoords = async (lat, lng) => {
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}&limit=1`);
      const data = await response.json();
      
      if (data.status === 200 && data.result && data.result.length > 0) {
        return data.result[0].postcode;
      }
      return null;
    } catch (error) {
      console.error('Error fetching postcode:', error);
      return null;
    }
  };

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(locationData);
          
          // Get postcode for this location
          const postcodeData = await getPostcodeFromCoords(
            locationData.latitude, 
            locationData.longitude
          );
          setPostcode(postcodeData);
        },
        (error) => {
          setLocationError('Location access denied. Please enable location services.');
          console.error('Location error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
    }

    // Listen for sessions from this user
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('engineerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Separate active and non-active sessions
      const active = sessions.filter(session => session.status === 'active');
      const nonActive = sessions.filter(session => session.status !== 'active');
      
      // Sort active sessions by start time (newest first)
      active.sort((a, b) => {
        const aTime = a.startTime?.toDate() || new Date(0);
        const bTime = b.startTime?.toDate() || new Date(0);
        return bTime - aTime;
      });
      
      // Sort non-active sessions by completion time (most recently completed first)
      nonActive.sort((a, b) => {
        // Get completion time for each session
        const getCompletionTime = (session) => {
          if (session.status === 'completed' && session.endTime) {
            return session.endTime.toDate();
          } else if (session.status === 'cancelled' && session.cancelledAt) {
            return session.cancelledAt.toDate();
          } else if (session.endTime) {
            return session.endTime.toDate();
          } else {
            // Fallback to start time if no completion time
            return session.startTime?.toDate() || new Date(0);
          }
        };
        
        const aCompletionTime = getCompletionTime(a);
        const bCompletionTime = getCompletionTime(b);
        
        // Most recent completion first
        return bCompletionTime - aCompletionTime;
      });
      
      setActiveSessions(active);
      setCompletedSessions(nonActive.slice(0, 15)); // Show last 15 completed/cancelled sessions
    }, (error) => {
      console.error('Firestore query error:', error);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleCheckIn = async () => {
    if (!location) {
      alert('Location is required for check-in. Please enable location services.');
      return;
    }

    const jointId = prompt('Enter Joint ID/Reference:');
    if (!jointId) return;

    const workDescription = prompt('Brief description of work to be done:');
    if (!workDescription) return;

    setLoading(true);

    try {
      // Get postcode for check-in location
      const currentPostcode = await getPostcodeFromCoords(
        location.latitude, 
        location.longitude
      );

      await addDoc(collection(db, 'sessions'), {
        engineerId: user.uid,
        engineerEmail: user.email,
        jointId: jointId.trim(),
        workDescription: workDescription.trim(),
        status: 'active',
        startTime: new Date(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          postcode: currentPostcode
        },
        createdAt: new Date()
      });
      
      alert('Successfully checked in!');
    } catch (error) {
      console.error('Check-in error:', error);
      alert('Error checking in: ' + error.message);
    }
    setLoading(false);
  };

  const handleCancelSession = async (session) => {
    const reason = prompt('Reason for cancelling this work session (optional):');
    
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel this work session?\n\nJoint ID: ${session.jointId}\nWork: ${session.workDescription}\n\nThis action cannot be undone.`
    );

    if (!confirmCancel) return;

    setCancelling(session.id);

    try {
      // Calculate work duration up to cancellation
      const cancelTime = new Date();
      const duration = Math.floor((cancelTime - session.startTime.toDate()) / (1000 * 60)); // minutes

      // Update session in Firestore
      await updateDoc(doc(db, 'sessions', session.id), {
        status: 'cancelled',
        cancelledAt: cancelTime,
        endTime: cancelTime,
        duration: duration,
        cancellationReason: reason ? reason.trim() : 'No reason provided',
        cancelledBy: user.email
      });

      alert('Work session cancelled successfully.');
    } catch (error) {
      console.error('Cancel session error:', error);
      alert('Error cancelling session: ' + error.message);
    }

    setCancelling(null);
  };

  const handleCheckOutClick = (session) => {
    setSelectedSession(session);
    setShowCheckOut(true);
  };

  const handleCheckOutComplete = () => {
    setShowCheckOut(false);
    setSelectedSession(null);
  };

  const handleCheckOutCancel = () => {
    setShowCheckOut(false);
    setSelectedSession(null);
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getSessionDuration = (startTime, endTime) => {
    if (!startTime) return 'N/A';
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const end = endTime ? (endTime.toDate ? endTime.toDate() : new Date(endTime)) : new Date();
    const duration = Math.floor((end - start) / (1000 * 60)); // Duration in minutes
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active': return 'active';
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      default: return 'unknown';
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Fibre Joint Engineer Dashboard</h2>
        <div className="user-info">
          <span>👨‍🔧 {user.email}</span>
          <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Location Status */}
        <div className="location-status">
          {location ? (
            <div>
              <p>📍 Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} 
                 (±{Math.round(location.accuracy)}m)</p>
              {postcode && (
                <p>🏠 Nearest Postcode: <strong>{postcode}</strong></p>
              )}
            </div>
          ) : (
            <p className="error">⚠️ {locationError || 'Getting location...'}</p>
          )}
        </div>

        {/* Check In Section */}
        <div className="check-in-section">
          <h3>🔧 Start New Work Session</h3>
          <button 
            onClick={handleCheckIn} 
            className="checkin-btn"
            disabled={!location || loading}
          >
            {loading ? 'Checking In...' : '🔧 Check In to Joint Location'}
          </button>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="active-sessions">
            <h3>⚡ Active Work Sessions ({activeSessions.length})</h3>
            <div className="sessions-list">
              {activeSessions.map(session => (
                <div key={session.id} className="session-card active">
                  <div className="session-header">
                    <h4>Joint ID: {session.jointId}</h4>
                    <span className="status active">ACTIVE</span>
                  </div>
                  <p><strong>Work:</strong> {session.workDescription}</p>
                  <p><strong>Started:</strong> {formatTime(session.startTime)}</p>
                  <p><strong>Duration:</strong> {getSessionDuration(session.startTime)}</p>
                  <p><strong>Location:</strong> {session.location ? 
                    `${session.location.latitude.toFixed(4)}, ${session.location.longitude.toFixed(4)}` : 
                    'Not available'}
                    {session.location?.postcode && (
                      <span> (Near <strong>{session.location.postcode}</strong>)</span>
                    )}
                  </p>
                  <div className="session-actions">
                    <button 
                      className="checkout-btn"
                      onClick={() => handleCheckOutClick(session)}
                    >
                      🏁 Complete & Check Out
                    </button>
                    <button 
                      className="cancel-btn"
                      onClick={() => handleCancelSession(session)}
                      disabled={cancelling === session.id}
                    >
                      {cancelling === session.id ? 'Cancelling...' : '❌ Cancel Session'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sessions (Sorted by Completion Time) */}
        <div className="recent-sessions">
          <h3>📋 Recent Work History ({completedSessions.length} sessions) - Most Recent First</h3>
          {completedSessions.length > 0 ? (
            <div className="sessions-list">
              {completedSessions.map(session => (
                <div key={session.id} className={`session-card ${session.status}`}>
                  <div className="session-header">
                    <h4>Joint ID: {session.jointId}</h4>
                    <span className={`status ${getStatusBadgeClass(session.status)}`}>
                      {session.status.toUpperCase()}
                    </span>
                  </div>
                  <p><strong>Work:</strong> {session.workDescription}</p>
                  <p><strong>Started:</strong> {formatTime(session.startTime)}</p>
                  
                  {session.status === 'completed' && session.endTime && (
                    <p><strong>✅ Completed:</strong> {formatTime(session.endTime)}</p>
                  )}
                  
                  {session.status === 'cancelled' && (
                    <>
                      <p><strong>❌ Cancelled:</strong> {formatTime(session.cancelledAt)}</p>
                      <p><strong>Reason:</strong> {session.cancellationReason}</p>
                    </>
                  )}
                  
                  <p><strong>Duration:</strong> {getSessionDuration(session.startTime, session.endTime || session.cancelledAt)}</p>
                  
                  <p><strong>📍 Check-in Location:</strong> {session.location ? 
                    `${session.location.latitude.toFixed(4)}, ${session.location.longitude.toFixed(4)} (±${Math.round(session.location.accuracy || 0)}m)` : 
                    'Location not recorded'}
                    {session.location?.postcode && (
                      <span> - <strong>{session.location.postcode}</strong></span>
                    )}
                  </p>
                  
                  {session.status === 'completed' && (
                    <>
                      {session.jointRating && (
                        <p><strong>Joint Rating:</strong> {session.jointRating}/10 {'⭐'.repeat(Math.ceil(session.jointRating / 2))}</p>
                      )}
                      {session.workQuality && (
                        <p><strong>Quality:</strong> <span className={`quality-badge ${session.workQuality}`}>
                          {session.workQuality.replace('_', ' ').toUpperCase()}
                        </span></p>
                      )}
                      {session.completionNotes && (
                        <p><strong>Notes:</strong> {session.completionNotes}</p>
                      )}
                      {session.photos && session.photos.length > 0 && (
                        <p><strong>Photos:</strong> {session.photos.length} uploaded</p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>No work history yet. Complete your first work session!</p>
          )}
        </div>
      </div>

      {/* Check Out Modal */}
      {showCheckOut && selectedSession && (
        <CheckOut
          session={selectedSession}
          onComplete={handleCheckOutComplete}
          onCancel={handleCheckOutCancel}
        />
      )}
    </div>
  );
}

export default Dashboard; 