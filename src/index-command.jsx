import React from 'react';
import { createRoot } from 'react-dom/client';
import Command from './components/Command';
import './styles/command.css';

const root = createRoot(document.getElementById('root'));
root.render(<Command />);

