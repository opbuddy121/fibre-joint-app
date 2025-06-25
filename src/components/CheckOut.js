import React, { useState } from 'react';
import { db, storage } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './CheckOut.css';

function CheckOut({ session, onComplete, onCancel }) {
  const [completionNotes, setCompletionNotes] = useState('');
  const [jointRating, setJointRating] = useState(5);
  const [workQuality, setWorkQuality] = useState('good');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    setPhotos(files);
  };

  const uploadPhotos = async (sessionId) => {
    const photoUrls = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const fileName = `sessions/${sessionId}/photo_${i + 1}_${Date.now()}.jpg`;
      const photoRef = ref(storage, fileName);
      
      try {
        const snapshot = await uploadBytes(photoRef, photo);
        const downloadURL = await getDownloadURL(snapshot.ref);
        photoUrls.push({
          url: downloadURL,
          fileName: photo.name,
          uploadedAt: new Date()
        });
      } catch (error) {
        console.error('Error uploading photo:', error);
      }
    }
    
    return photoUrls;
  };

  const handleCheckOut = async () => {
    if (!completionNotes.trim()) {
      alert('Please add completion notes before checking out.');
      return;
    }

    setUploading(true);

    try {
      // Upload photos if any
      const photoUrls = photos.length > 0 ? await uploadPhotos(session.id) : [];

      // Calculate work duration
      const endTime = new Date();
      const duration = Math.floor((endTime - session.startTime.toDate()) / (1000 * 60)); // minutes

      // Update session in Firestore
      await updateDoc(doc(db, 'sessions', session.id), {
        status: 'completed',
        endTime: endTime,
        completionNotes: completionNotes.trim(),
        jointRating: jointRating,
        workQuality: workQuality,
        photos: photoUrls,
        duration: duration,
        completedAt: endTime
      });

      alert('Successfully checked out!');
      onComplete();
    } catch (error) {
      console.error('Check-out error:', error);
      alert('Error during check-out: ' + error.message);
    }

    setUploading(false);
  };

  const getWorkDuration = () => {
    if (!session.startTime) return '0 minutes';
    const now = new Date();
    const start = session.startTime.toDate();
    const duration = Math.floor((now - start) / (1000 * 60));
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="checkout-overlay">
      <div className="checkout-modal">
        <div className="checkout-header">
          <h2>🏁 Complete Work Session</h2>
          <button onClick={onCancel} className="close-btn">×</button>
        </div>

        <div className="checkout-content">
          {/* Session Summary */}
          <div className="session-summary">
            <h3>Session Summary</h3>
            <p><strong>Joint ID:</strong> {session.jointId}</p>
            <p><strong>Work:</strong> {session.workDescription}</p>
            <p><strong>Started:</strong> {session.startTime.toDate().toLocaleString()}</p>
            <p><strong>Duration:</strong> {getWorkDuration()}</p>
          </div>

          {/* Completion Notes */}
          <div className="form-section">
            <label htmlFor="completionNotes">
              <strong>Work Completion Notes *</strong>
            </label>
            <textarea
              id="completionNotes"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Describe the work completed, any issues encountered, materials used, etc."
              rows={4}
              required
            />
          </div>

          {/* Joint Rating */}
          <div className="form-section">
            <label htmlFor="jointRating">
              <strong>Joint Condition Rating</strong>
            </label>
            <div className="rating-section">
              <input
                type="range"
                id="jointRating"
                min="1"
                max="10"
                value={jointRating}
                onChange={(e) => setJointRating(parseInt(e.target.value))}
              />
              <span className="rating-display">
                {jointRating}/10 {'⭐'.repeat(Math.ceil(jointRating / 2))}
              </span>
            </div>
            <small>1 = Poor condition, 10 = Excellent condition</small>
          </div>

          {/* Work Quality */}
          <div className="form-section">
            <label htmlFor="workQuality">
              <strong>Work Quality Assessment</strong>
            </label>
            <select
              id="workQuality"
              value={workQuality}
              onChange={(e) => setWorkQuality(e.target.value)}
            >
              <option value="excellent">Excellent - Perfect completion</option>
              <option value="good">Good - Completed as expected</option>
              <option value="satisfactory">Satisfactory - Minor issues</option>
              <option value="needs_review">Needs Review - Requires follow-up</option>
            </select>
          </div>

          {/* Photo Upload */}
          <div className="form-section">
            <label htmlFor="photos">
              <strong>Upload Work Photos</strong>
            </label>
            <input
              type="file"
              id="photos"
              multiple
              accept="image/*"
              onChange={handlePhotoUpload}
            />
            {photos.length > 0 && (
              <div className="photo-preview">
                <p>{photos.length} photo(s) selected</p>
                <ul>
                  {photos.map((photo, index) => (
                    <li key={index}>{photo.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="checkout-actions">
            <button
              onClick={handleCheckOut}
              disabled={uploading || !completionNotes.trim()}
              className="complete-btn"
            >
              {uploading ? 'Processing...' : '✅ Complete & Check Out'}
            </button>
            <button onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckOut; 