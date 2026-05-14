import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container">
                <div className="row align-items-center">
                    {/* Left side - UberEats Logo */}
                    <div className="col-md-6">
                        <div className="footer-logo">
                            <Link to="/" className="text-decoration-none text-dark">
                                <span className="uber-eats-text">
                                    Uber <b>Eats</b>
                                </span>
                            </Link>
                        </div>
                    </div>
                    
                    {/* Right side - Links in two columns */}
                    <div className="col-md-6">
                        <div className="row">
                            <div className="col-6">
                                <ul className="footer-links">
                                    <li><Link to="/about">About Us</Link></li>
                                    <li><Link to="/restaurant/signup">Add your Restaurant</Link></li>
                                    <li><Link to="/restaurant/login">Manage your Restaurant</Link></li>
                                </ul>
                            </div>
                            <div className="col-6">
                                <ul className="footer-links">
                                    <li><Link to="/customer/signup">Signup as Customer</Link></li>
                                    <li><Link to="/customer/login">Login as Customer</Link></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer; 