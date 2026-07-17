import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Container, Spinner } from 'react-bootstrap';
import UserContext from './UserContext';
import NavHeader from './components/NavHeader';
import HomePage from './components/HomePage';
import LoginForm from './components/LoginForm';
import Configurator from './components/Configurator';
import OrdersPage from './components/OrdersPage';
import { API } from './API';

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    API.getCurrentUser()
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) return <Spinner animation="border" className="m-3" />;

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <NavHeader />
      <Container className="mt-3">
        <Routes>
          <Route path="/"            element={<HomePage />} />
          <Route path="/login"       element={<LoginForm />} />
          <Route path="/configurator" element={user ? <Configurator /> : <Navigate to="/login" />} />
          <Route path="/orders"      element={user ? <OrdersPage /> : <Navigate to="/login" />} />
          <Route path="*"            element={<Navigate to="/" />} />
        </Routes>
      </Container>
    </UserContext.Provider>
  );
}

export default App;
