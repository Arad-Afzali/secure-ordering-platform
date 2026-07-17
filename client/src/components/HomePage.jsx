import { useState, useEffect } from 'react';
import { Row, Col, Card, Badge, ListGroup, Spinner, Alert } from 'react-bootstrap';
import { API } from '../API';

function HomePage() {
  const [sizes, setSizes] = useState([]);
  const [mains, setMains] = useState([]);
  const [breads, setBreads] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [dressings, setDressings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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
      })
      .catch(err => setError(err.error || 'Failed to load menu.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner animation="border" />;
  if (error)   return <Alert variant="danger">{error}</Alert>;

  return (
    <>
      <h2 className="mb-3">Today's Availability</h2>
      <Row className="mb-4 g-3">
        {sizes.map(s => (
          <Col key={s.code} xs={12} sm={4}>
            <Card className="text-center h-100">
              <Card.Body>
                <Card.Title>{s.name} ({s.code})</Card.Title>
                <Card.Text>Base price: <strong>{s.base_price}€</strong></Card.Text>
                <Card.Text>
                  Available:{' '}
                  <Badge bg={s.available > 0 ? 'success' : 'danger'}>
                    {s.available} / {s.daily_limit}
                  </Badge>
                </Card.Text>
                <Card.Text className="text-muted small">
                  Includes {s.included_ingredients} optional ingredients,
                  up to {s.max_dressings} dressing{s.max_dressings !== 1 ? 's' : ''}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <h2 className="mb-3">Menu</h2>
      <Row className="g-3">
        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100">
            <Card.Header><strong>Main Ingredients</strong></Card.Header>
            <ListGroup variant="flush">
              {mains.map(m => <ListGroup.Item key={m.id}>{m.name}</ListGroup.Item>)}
            </ListGroup>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100">
            <Card.Header><strong>Breads</strong></Card.Header>
            <ListGroup variant="flush">
              {breads.map(b => <ListGroup.Item key={b.id}>{b.name}</ListGroup.Item>)}
            </ListGroup>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100">
            <Card.Header><strong>Optional Ingredients</strong></Card.Header>
            <ListGroup variant="flush">
              {ingredients.map(i => <ListGroup.Item key={i.id}>{i.name}</ListGroup.Item>)}
            </ListGroup>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100">
            <Card.Header><strong>Dressings</strong></Card.Header>
            <ListGroup variant="flush">
              {dressings.map(d => <ListGroup.Item key={d.id}>{d.name}</ListGroup.Item>)}
            </ListGroup>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default HomePage;
