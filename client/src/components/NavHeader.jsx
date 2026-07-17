import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router';
import { useUser } from '../UserContext';
import { API } from '../API';

function NavHeader() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  function handleLogout() {
    API.logout()
      .then(() => { setUser(null); navigate('/'); })
      .catch(() => { setUser(null); navigate('/'); });
  }

  return (
    <Navbar bg="dark" variant="dark" expand="md">
      <Container>
        <Navbar.Brand as={NavLink} to="/">Sandwich</Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse>
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/">Home</Nav.Link>
            {user && <Nav.Link as={NavLink} to="/configurator">Order</Nav.Link>}
            {user && <Nav.Link as={NavLink} to="/orders">My Orders</Nav.Link>}
          </Nav>
          <Nav>
            {user ? (
              <>
                <Navbar.Text className="me-3">
                  {user.name} - {user.credit.toFixed(2)}€
                  {user.isTotp && ' (2FA)'}
                </Navbar.Text>
                <Button variant="outline-light" size="sm" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <Nav.Link as={NavLink} to="/login">Login</Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavHeader;
