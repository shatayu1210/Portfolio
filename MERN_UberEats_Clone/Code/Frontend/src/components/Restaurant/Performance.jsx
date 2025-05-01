// Performance metrics page for restaurant owners
// Displays average rating, total revenue, average order value, and completed order count
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRestaurant, fetchRestaurantOrders } from '../../redux/slices/restaurant/restaurantSlice';
import { fetchRestaurantRatings, clearRatings, selectRestaurantRatingStats } from '../../redux/slices/customer/ratingSlice';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Spinner, Alert, Button, Dropdown } from 'react-bootstrap';
import NavbarDark from '../Common/NavbarDark';

// Placeholder for reviewers without profile images
const DEFAULT_PROFILE_IMAGE = "https://res.cloudinary.com/dvylvq84d/image/upload/v1744050200/profile_placeholder.png";

const Performance = () => {
  const dispatch = useDispatch();
  const { restaurant, orders, ordersStatus, ordersError } = useSelector(state => state.restaurant);
  const restaurantId = useSelector(state => state.auth.restaurant?.id);
  // Review sorting state and selectors
  const [sortOption, setSortOption] = useState('latest');
  const [visibleCount, setVisibleCount] = useState(4);
  const { ratings, status: ratingsStatus, error: ratingsError } = useSelector(state => state.ratings);
  const ratingStats = useSelector(selectRestaurantRatingStats);

  useEffect(() => {
    if (restaurantId) {
      // Load restaurant details, orders, and reviews
      dispatch(fetchRestaurant(restaurantId));
      dispatch(fetchRestaurantOrders(restaurantId));
      dispatch(fetchRestaurantRatings(restaurantId));
    }
    return () => dispatch(clearRatings());
  }, [dispatch, restaurantId]);

  useEffect(() => {
    setVisibleCount(4);
  }, [sortOption, ratings]);

  if (ordersStatus === 'loading') {
    return (
      <div className="d-flex justify-content-center align-items-center mt-5 text-success">
        <Spinner animation="border" className="text-success" />
      </div>
    );
  }
  if (ordersError) {
    return <Alert variant="danger">Error: {ordersError}</Alert>;
  }

  // Filter only delivered and picked up orders for metrics
  const completed = orders.filter(o => ['delivered','picked_up'].includes(o.status));
  const totalRevenue = completed.reduce((sum, o) => sum + (o.financials?.totalAmount || 0), 0);
  const avgOrder = completed.length ? totalRevenue / completed.length : 0;
  const avgRating = restaurant?.rating || 0;
  const completedCount = completed.length;

  // Sort reviews based on selection
  const getSortedRatings = () => {
    let sorted = [...ratings];
    switch (sortOption) {
      case 'latest': sorted.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
      case 'oldest': sorted.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'highest': sorted.sort((a,b) => b.rating - a.rating); break;
      case 'lowest': sorted.sort((a,b) => a.rating - b.rating); break;
    }
    return sorted;
  };

  return (
    <>
      <NavbarDark />
      <div className="mb-3 px-3 px-md-5 mt-3">
        <Link to="/restaurant/dashboard" className="text-decoration-none text-dark fw-bold">← <u>Back to Dashboard</u></Link>
      </div>
      <Container className="mt-5 px-3 px-md-5 fw-bold">
        <h3 className="mb-4 fw-bold">Performance Metrics</h3>
        <Row className="g-3 mb-5">
          <Col xs={12} md={3} className="metric-card">
            <Card className="text-center fw-bold fs-3 rounded-4 border-light border-3 shadow-sm">
              <Card.Body>
                <Card.Title>Average Rating</Card.Title>
                <Card.Text className="fs-1 d-flex align-items-center justify-content-center">
                  {ratings.length > 0 ? (
                    <>
                      {avgRating.toFixed(1)} <i className="ms-1 bi bi-star-fill fs-3" style={{ fontSize: 'clamp(1rem, 2vw, 1.8rem)' }}></i>
                    </>
                  ) : 'N/A'}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} md={3} className="metric-card">
            <Card className="text-center fw-bold fs-3 rounded-4 border-light border-3 shadow-sm">
              <Card.Body>
                <Card.Title>Revenue</Card.Title>
                <Card.Text className="fs-1">{completedCount > 0 ? `$${totalRevenue.toFixed(2)}` : 'N/A'}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} md={3} className="metric-card">
            <Card className="text-center fw-bold fs-3 rounded-4 border-light border-3 shadow-sm">
              <Card.Body>
                <Card.Title>Average Order Value</Card.Title>
                <Card.Text className="fs-1">{completedCount > 0 ? `$${avgOrder.toFixed(2)}` : 'N/A'}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} md={3} className="metric-card">
            <Card className="text-center fw-bold fs-3 rounded-4 border-light border-3 shadow-sm">
              <Card.Body>
                <Card.Title>Completed Orders</Card.Title>
                <Card.Text className="fs-1">{completedCount > 0 ? completedCount : 'N/A'}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Reviews Section */}
        <h3 className="mb-4 fw-bold mt-5">Reviews</h3>
        {ratingsStatus === 'loading' ? (
          <div className="d-flex justify-content-center my-4">
            <Spinner animation="border" className="text-success" />
          </div>
        ) : ratingsError ? (
          <Alert variant="danger">{ratingsError}</Alert>
        ) : (
          <>
            <div className="d-flex align-items-center justify-content-start mb-3">
              <span className="me-2 fw-medium">Sort:</span>
              <Dropdown>
                <Dropdown.Toggle variant="light" className="text-dark rounded-pill py-1 px-3" style={{ border: '1px solid #ced4da' }}>
                  {sortOption === 'latest' ? 'Latest' : sortOption === 'oldest' ? 'Oldest' : sortOption === 'highest' ? 'High→Low' : 'Low→High'}
                </Dropdown.Toggle>
                <Dropdown.Menu className="shadow-sm rounded-3" style={{ minWidth: '150px', fontSize: '0.9rem' }}>
                  <div className="dropdown-animate">
                    {['latest','oldest','highest','lowest'].map(opt => (
                      <Dropdown.Item key={opt} className={sortOption === opt ? 'fw-bold text-dark' : ''} onClick={() => setSortOption(opt)}>
                        {opt === 'latest' ? 'Latest' : opt === 'oldest' ? 'Oldest' : opt === 'highest' ? 'High→Low' : 'Low→High'}
                      </Dropdown.Item>
                    ))}
                  </div>
                </Dropdown.Menu>
              </Dropdown>
            </div>
            <div className="row g-4">
              {ratings.length===0 && (
                <div className="mt-5 alert alert-light fw-medium">
                  There are no reviews for your restaurant.
                </div>
              )}
              {getSortedRatings().slice(0, visibleCount).map(review => (
                <div key={review.id || review._id} className="col-md-6">
                  <div className="card rating-card h-100 rounded-4 overflow-hidden">
                    <div className="card-body">
                      <div className="d-flex align-items-start mb-2">
                        <img src={review.customer?.imageUrl || DEFAULT_PROFILE_IMAGE} alt={review.customer?.name} className="rounded-circle me-3" style={{ width:'50px', height:'50px', objectFit:'cover' }} />
                        <div>
                          <h6 className="mb-1 fw-bold">{review.customer?.name}</h6>
                          <div className="d-flex align-items-center mb-1">
                            {Array.from({ length:5 }).map((_,i) => (
                              <i key={i} className={`bi ${i < review.rating ? 'bi-star-fill' : 'bi-star'}`} style={{ color: i < review.rating ? '#000' : '#ccc', fontSize:'0.85rem', marginRight:'2px' }} />
                            ))}
                            <small className="text-muted fw-medium ms-2">{new Date(review.createdAt).toLocaleDateString()}</small>
                          </div>
                        </div>
                      </div>
                      {review.review && <p className="review-text fw-medium mb-0">{review.review}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {visibleCount < getSortedRatings().length && (
              <div className="text-center my-3">
                <Button variant="light" className="text-dark" onClick={() => setVisibleCount(prev => prev + 4)}>
                  Show More
                </Button>
              </div>
            )}
          </>
        )}
      </Container>
    </>
  );
};

export default Performance;
