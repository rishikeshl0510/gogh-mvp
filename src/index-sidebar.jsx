import React from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './components/Sidebar';
import './styles/sidebar.css';

const root = createRoot(document.getElementById('root'));
root.render(<Sidebar />);

