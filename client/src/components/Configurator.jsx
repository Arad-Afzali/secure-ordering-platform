import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Row, Col, Form, Button, Alert, Card, ListGroup, Spinner } from 'react-bootstrap';
import { API } from '../API';
import { useUser } from '../UserContext';

const round2 = x => Math.round(x * 100) / 100;

function calcUnitPrice(sizeCode, ingredientIds, sizes) {
  const size = sizes.filter(s => s.code === sizeCode)[0];
  if (!size) return 0;
  const extras = Math.max(0, ingredientIds.length - size.included_ingredients);
  return round2(size.base_price * (1 + 0.30 * extras));
}

function calcOrderTotal(draft, sizes) {
  const subtotal = draft.reduce(
    (sum, s) => sum + calcUnitPrice(s.size, s.ingredient_ids, sizes) * s.quantity, 0
  );
  const nSand = draft.reduce((sum, s) => sum + s.quantity, 0);
  return nSand >= 4 ? round2(subtotal * 0.80) : round2(subtotal);
}

function SandwichForm({ sizes, mains, breads, ingredients, dressings, draft, onAdd }) {
  const [size, setSize]               = useState('');
  const [mainId, setMainId]           = useState('');
  const [breadId, setBreadId]         = useState('');
  const [ingredientIds, setIngredientIds] = useState([]);
  const [dressingIds, setDressingIds] = useState([]);
  const [quantity, setQuantity]       = useState(1);

  const selectedSize = sizes.filter(s => s.code === size)[0];

  function draftAvailableForSize(code) {
    const s = sizes.filter(x => x.code === code)[0];
    if (!s) return 0;
    const usedInDraft = draft.filter(d => d.size === code)
                             .reduce((sum, d) => sum + d.quantity, 0);
    return s.available - usedInDraft;
  }

  function handleSizeChange(newSize) {
    setSize(newSize);
    setQuantity(1);
    const s = sizes.filter(x => x.code === newSize)[0];
    if (s) setDressingIds(ids => ids.slice(0, s.max_dressings));
  }

  function toggleIngredient(id) {
    setIngredientIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleDressing(id) {
    setDressingIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (selectedSize && prev.length >= selectedSize.max_dressings) return prev;
      return [...prev, id];
    });
  }

  function handleAdd(e) {
    e.preventDefault();
    onAdd({
      size,
      main_id: Number(mainId),
      bread_id: Number(breadId),
      ingredient_ids: [...ingredientIds],
      dressing_ids: [...dressingIds],
      quantity,
    });
    setSize(''); setMainId(''); setBreadId('');
    setIngredientIds([]); setDressingIds([]); setQuantity(1);
  }

  const avail = size ? draftAvailableForSize(size) : 0;
  const price = size ? calcUnitPrice(size, ingredientIds, sizes) : 0;
  const canAdd = size && mainId && breadId && quantity >= 1 && quantity <= avail;

  return (
    <Card className="mb-4">
      <Card.Header><strong>Add a Sandwich</strong></Card.Header>
      <Card.Body>
        <Form onSubmit={handleAdd}>
          <Row className="g-3 mb-3">
            <Col md={4}>
              <Form.Label>Size</Form.Label>
              <Form.Select value={size} onChange={e => handleSizeChange(e.target.value)} required>
                <option value="">Choose size...</option>
                {sizes.map(s => {
                  const avail = draftAvailableForSize(s.code);
                  return (
                    <option key={s.code} value={s.code} disabled={avail <= 0}>
                      {s.name} - {s.base_price}€ - {avail} left
                    </option>
                  );
                })}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Main Ingredient</Form.Label>
              <Form.Select value={mainId} onChange={e => setMainId(e.target.value)} required>
                <option value="">Choose main...</option>
                {mains.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Bread</Form.Label>
              <Form.Select value={breadId} onChange={e => setBreadId(e.target.value)} required>
                <option value="">Choose bread...</option>
                {breads.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Form.Select>
            </Col>
          </Row>

          {size && (
            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Label>
                  Optional Ingredients
                  <span className="text-muted ms-2 small">
                    ({ingredientIds.length} chosen - {selectedSize.included_ingredients} included in price)
                  </span>
                </Form.Label>
                {ingredients.map(i => (
                  <Form.Check key={i.id} type="checkbox" id={`ing-${i.id}`}
                    label={i.name}
                    checked={ingredientIds.includes(i.id)}
                    onChange={() => toggleIngredient(i.id)}
                  />
                ))}
              </Col>
              <Col md={6}>
                <Form.Label>
                  Dressings
                  <span className="text-muted ms-2 small">(max {selectedSize.max_dressings})</span>
                </Form.Label>
                {dressings.map(d => (
                  <Form.Check key={d.id} type="checkbox" id={`drs-${d.id}`}
                    label={d.name}
                    checked={dressingIds.includes(d.id)}
                    onChange={() => toggleDressing(d.id)}
                    disabled={!dressingIds.includes(d.id) && dressingIds.length >= selectedSize.max_dressings}
                  />
                ))}
              </Col>
            </Row>
          )}

          <Row className="g-3 align-items-end">
            <Col md={3}>
              <Form.Label>Quantity</Form.Label>
              <Form.Control type="number" min={1} max={avail || 1}
                value={quantity} disabled={!size}
                onChange={e => setQuantity(Number(e.target.value))}
              />
            </Col>
            <Col md={5}>
              {size && (
                <span className="text-muted">
                  Unit price: <strong>{price}€</strong>
                  <span className="ms-3">({avail} available)</span>
                </span>
              )}
            </Col>
            <Col md={4} className="text-end">
              <Button type="submit" disabled={!canAdd}>Add to Order</Button>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}

function DraftList({ draft, sizes, onRemove }) {
  const total = calcOrderTotal(draft, sizes);
  const nSand = draft.reduce((sum, s) => sum + s.quantity, 0);
  const hasDiscount = nSand >= 4;

  if (draft.length === 0)
    return <p className="text-muted">No sandwiches added yet.</p>;

  return (
    <Card>
      <Card.Header><strong>Current Order</strong></Card.Header>
      <ListGroup variant="flush">
        {draft.map(s => {
          const price = calcUnitPrice(s.size, s.ingredient_ids, sizes);
          return (
            <ListGroup.Item key={s.id} className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{s.quantity}x {s.size}</strong>
                <span className="text-muted ms-2">
                  {price}€ each, {s.ingredient_ids.length} ingr, {s.dressing_ids.length} dressings
                </span>
              </div>
              <div>
                <span className="me-3">{round2(price * s.quantity)}€</span>
                <Button size="sm" variant="outline-danger" onClick={() => onRemove(s.id)}>X</Button>
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>
      <Card.Footer>
        {hasDiscount && (
          <div className="text-success small mb-1">
            20% discount applied ({nSand} sandwiches, 4 or more)
          </div>
        )}
        <strong>Order total: {total}€</strong>
      </Card.Footer>
    </Card>
  );
}

function Configurator() {
  const [draft, setDraft]           = useState([]);
  const [sizes, setSizes]           = useState([]);
  const [mains, setMains]           = useState([]);
  const [breads, setBreads]         = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [dressings, setDressings]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [notice, setNotice]         = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { user, setUser } = useUser();
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    Promise.all([
      API.getSizes(),
      API.getMainIngredients(),
      API.getBreads(),
      API.getIngredients(),
      API.getDressings(),
    ])
      .then(([s, m, b, i, d]) => {
        setSizes(s);
        setMains(m);
        setBreads(b);
        setIngredients(i);
        setDressings(d);
        // Support duplicate flow (from OrdersPage via navigate state):
        // re-apply add-time availability checks - clamp each line to what is
        // still available for its size, drop lines that reach 0
        if (location.state && location.state.draft) {
          const remaining = {};
          for (const x of s) remaining[x.code] = x.available;
          const loaded = [];
          let reduced = false;
          for (const item of location.state.draft) {
            const qty = Math.min(item.quantity, remaining[item.size] || 0);
            if (qty < item.quantity) reduced = true;
            if (qty >= 1) {
              remaining[item.size] -= qty;
              loaded.push({ ...item, quantity: qty, id: Date.now() + Math.random() });
            }
          }
          setDraft(loaded);
          if (reduced)
            setNotice('Some duplicated sandwiches were reduced or removed: not enough availability today.');
        }
      })
      .catch(() => setError('Failed to load menu.'))
      .finally(() => setLoading(false));
  }, []);

  function handleAdd(sandwich) {
    setDraft(prev => [...prev, { ...sandwich, id: Date.now() + Math.random() }]);
  }

  function handleRemove(id) {
    setDraft(prev => prev.filter(s => s.id !== id));
  }

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await API.createOrder(
        draft.map(s => ({
          size: s.size,
          main_id: s.main_id,
          bread_id: s.bread_id,
          quantity: s.quantity,
          ingredient_ids: s.ingredient_ids,
          dressing_ids: s.dressing_ids,
        }))
      );
      setUser(prev => ({ ...prev, credit: result.credit }));
      navigate('/orders');
    } catch (err) {
      setError(err.error || 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner animation="border" />;

  const total = calcOrderTotal(draft, sizes);
  const creditOk = total <= user.credit;

  return (
    <>
      <h2 className="mb-1">Configure Your Order</h2>
      <p className="text-muted mb-3">
        Credit available: <strong>{user.credit.toFixed(2)}€</strong>
      </p>

      {notice && <Alert variant="warning">{notice}</Alert>}

      <SandwichForm
        sizes={sizes} mains={mains} breads={breads}
        ingredients={ingredients} dressings={dressings}
        draft={draft} onAdd={handleAdd}
      />

      <DraftList draft={draft} sizes={sizes} onRemove={handleRemove} />

      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

      {draft.length > 0 && (
        <div className="mt-3 text-end">
          {!creditOk && (
            <div className="text-danger small mb-1">Insufficient credit for this order.</div>
          )}
          <Button variant="success" size="lg"
            onClick={handleConfirm}
            disabled={submitting || !creditOk}
          >
            {submitting ? 'Placing order...' : `Confirm Order - ${total}€`}
          </Button>
        </div>
      )}
    </>
  );
}

export default Configurator;
