import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, ListGroup, Button, Alert, Spinner } from 'react-bootstrap';
import { API } from '../API';
import { useUser } from '../UserContext';

function OrderItem({ order, mains, breads, sizes, onDelete, user }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function mainName(id) {
    const found = mains.filter(m => m.id === id)[0];
    return found ? found.name : String(id);
  }
  function breadName(id) {
    const found = breads.filter(b => b.id === id)[0];
    return found ? found.name : String(id);
  }
  function sizeName(code) {
    const found = sizes.filter(s => s.code === code)[0];
    return found ? found.name : code;
  }

  function handleDuplicate() {
    const draft = order.sandwiches.map(s => ({
      size:           s.size_code,
      main_id:        s.main_id,
      bread_id:       s.bread_id,
      quantity:       s.quantity,
      ingredient_ids: s.ingredients.map(i => i.id),
      dressing_ids:   s.dressings.map(d => d.id),
    }));
    navigate('/configurator', { state: { draft } });
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await API.deleteOrder(order.id);
      onDelete(order.id, result.credit);
    } catch (err) {
      setDeleteError(err.error || 'Failed to delete order.');
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span><strong>Order #{order.id}</strong></span>
        <span>Total: <strong>{order.total.toFixed(2)}€</strong></span>
      </Card.Header>

      <ListGroup variant="flush">
        {order.sandwiches.map(s => (
          <ListGroup.Item key={s.id}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <strong>{s.quantity}x {sizeName(s.size_code)}</strong>
                {' - '}{mainName(s.main_id)}, {breadName(s.bread_id)}
                {s.ingredients.length > 0 && (
                  <div className="text-muted small">
                    Ingredients: {s.ingredients.map(i => i.name).join(', ')}
                  </div>
                )}
                {s.dressings.length > 0 && (
                  <div className="text-muted small">
                    Dressings: {s.dressings.map(d => d.name).join(', ')}
                  </div>
                )}
              </div>
              <div className="text-end text-nowrap ms-3">
                <div>{s.unit_price.toFixed(2)}€ each</div>
                <div className="text-muted small">{(s.unit_price * s.quantity).toFixed(2)}€</div>
              </div>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>

      <Card.Footer>
        {deleteError && <Alert variant="danger" className="mb-2 py-1 px-2 small">{deleteError}</Alert>}
        <div className="d-flex justify-content-between align-items-center">
          <Button variant="outline-primary" size="sm" onClick={handleDuplicate}>
            Duplicate
          </Button>

          {!confirming ? (
            <Button
              variant="outline-danger"
              size="sm"
              disabled={!user.isTotp}
              title={!user.isTotp ? '2FA required to delete orders' : ''}
              onClick={() => setConfirming(true)}
            >
              Delete
            </Button>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <span className="text-danger small">Delete this order?</span>
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Confirm'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </Card.Footer>
    </Card>
  );
}

function OrdersPage() {
  const [orders, setOrders]   = useState([]);
  const [mains, setMains]     = useState([]);
  const [breads, setBreads]   = useState([]);
  const [sizes, setSizes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const { user, setUser }     = useUser();

  useEffect(() => {
    Promise.all([
      API.getOrders(),
      API.getMainIngredients(),
      API.getBreads(),
      API.getSizes(),
    ])
      .then(([o, m, b, s]) => {
        setOrders(o);
        setMains(m);
        setBreads(b);
        setSizes(s);
      })
      .catch(err => setError(err.error || 'Failed to load orders.'))
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(orderId, newCredit) {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setUser(prev => ({ ...prev, credit: newCredit }));
  }

  if (loading) return <Spinner animation="border" />;
  if (error)   return <Alert variant="danger">{error}</Alert>;

  return (
    <>
      <h2 className="mb-3">Your Orders</h2>

      {user.canDoTotp && !user.isTotp && (
        <Alert variant="warning">
          Log in with 2FA to enable order deletion.
        </Alert>
      )}

      {orders.length === 0 ? (
        <p className="text-muted">You have no confirmed orders yet.</p>
      ) : (
        orders.map(o => (
          <OrderItem
            key={o.id}
            order={o}
            mains={mains}
            breads={breads}
            sizes={sizes}
            onDelete={handleDelete}
            user={user}
          />
        ))
      )}
    </>
  );
}

export default OrdersPage;
