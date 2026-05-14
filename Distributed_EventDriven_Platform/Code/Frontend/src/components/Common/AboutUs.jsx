import React from 'react';
import NavbarDark from './NavbarDark';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

const AboutUs = () => {
    const { isCustomerAuthenticated, isRestaurantAuthenticated } = useSelector((state) => state.auth);

    // Determine the back link based on authentication status
    const getBackLink = () => {
        if (isCustomerAuthenticated) {
            return "/restaurants";
        } else if (isRestaurantAuthenticated) {
            return "/restaurant/dashboard";
        }
        return "/";
    };

    return (
        <>
            <NavbarDark />
            <Link to={getBackLink()} style={{ textDecoration: 'none' }}>
                <button
                    className="btn text-dark border-0 d-flex align-items-center mt-3 ms-4 fw-bold"
                    style={{ backgroundColor: 'transparent' }}
                >
                    <span className="fs-5 me-1">←</span><u>Back to Home</u>
                </button>
            </Link>
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-8 text-center">
                        <h2 className="mb-4 fw-bold">About This Project</h2>
                        <div className="card shadow-sm">
                            <div className="card-body p-5">
                                <p className="lead mb-4">
                                    This is a Practical Implementation of MERN Stack as part of the Distributed Systems 
                                    Coursework on the domain of UberEats.
                                </p>
                                <h4 className="mb-3">Developed By</h4>
                                <div className="mb-4">
                                    <p className="mb-1">Shatayu Thakur</p>
                                    <a href="mailto:shatayu.thakur@sjsu.edu" className="text-decoration-none text-primary">
                                        shatayu.thakur@sjsu.edu
                                    </a>
                                </div>
                                <div className="mb-4">
                                    <p className="mb-1">Dharmitkumar Patel</p>
                                    <a href="mailto:dharmitkumarsureshbhai.patel@sjsu.edu" className="text-decoration-none text-primary">
                                        dharmitkumarsureshbhai.patel@sjsu.edu
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AboutUs; 