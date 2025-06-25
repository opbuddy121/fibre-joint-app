import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
  return (
    <div className="App">
      <header className="App-header">
          <h2>Fibre Joint App</h2>
          <p>Loading...</p>
      </header>
    </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {user ? <Dashboard /> : <Login />}
      </div>
    </Router>
  );
}

export default App;
