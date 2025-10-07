import React from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './components/Panel';
import './styles/panel.css';

const root = createRoot(document.getElementById('root'));
root.render(<Panel />);

