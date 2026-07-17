import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Form, Button, Alert } from 'react-bootstrap';
import { API } from '../API';
import { useUser } from '../UserContext';

function TotpForm({ onVerify, onSkip }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    API.loginTotp(code)
      .then(() => onVerify())
      .catch(err => setError(err.error || 'Invalid code.'))
      .finally(() => setLoading(false));
  }

  return (
    <>
      <Alert variant="info">
        Your account supports two-factor authentication. Enter a TOTP code, or
        skip to continue without it - deletion of orders will be disabled.
      </Alert>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>TOTP Code</Form.Label>
          <Form.Control
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
            autoComplete="one-time-code"
          />
        </Form.Group>
        <Button type="submit" disabled={loading || code.length === 0} className="me-2">
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
        <Button variant="secondary" onClick={onSkip}>
          Skip
        </Button>
      </Form>
    </>
  );
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const { setUser } = useUser();
  const navigate = useNavigate();

  function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    API.login(username, password)
      .then(user => {
        if (user.canDoTotp) {
          setPendingUser(user);
        } else {
          setUser(user);
          navigate('/');
        }
      })
      .catch(err => setError(err.error || 'Login failed.'))
      .finally(() => setLoading(false));
  }

  function handleTotpVerified() {
    // Re-fetch so isTotp reflects the session update
    API.getCurrentUser()
      .then(u => { setUser(u); navigate('/'); })
      .catch(() => { setUser(pendingUser); navigate('/'); });
  }

  function handleTotpSkipped() {
    setUser(pendingUser);
    navigate('/');
  }

  if (pendingUser) {
    return (
      <>
        <h2 className="mb-3">Two-Factor Authentication</h2>
        <TotpForm onVerify={handleTotpVerified} onSkip={handleTotpSkipped} />
      </>
    );
  }

  return (
    <>
      <h2 className="mb-3">Login</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form onSubmit={handleLogin} style={{ maxWidth: '400px' }}>
        <Form.Group className="mb-3">
          <Form.Label>Username</Form.Label>
          <Form.Control
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </Form.Group>
        <Button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </Form>
    </>
  );
}

export default LoginForm;
