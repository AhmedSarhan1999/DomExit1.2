import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * InvestorsPage has been decommissioned per architectural directive.
 * Platform philosophy strictly separates distressed DDU sellers and bona fide home buyers.
 * All VIP / early-access privileges are consolidated into the 48h VIP early access showcase (/vip-catalog).
 */
export const InvestorsPage: React.FC = () => {
  return <Navigate to="/vip-catalog" replace />;
};
