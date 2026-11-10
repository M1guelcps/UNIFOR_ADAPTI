// Ícones do menu (os mesmos SVGs das telas HTML originais).
const contorno = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const IconeInicio = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3L12 3z" /></svg>
);

export const IconePraticar = () => (
  <svg {...contorno}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
);

export const IconeDesempenho = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="14" width="4" height="7" rx="1" /><rect x="10" y="9" width="4" height="12" rx="1" /><rect x="17" y="4" width="4" height="17" rx="1" />
  </svg>
);

export const IconeUsuarios = () => (
  <svg {...contorno}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

export const IconeProfessor = () => (
  <svg {...contorno}><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg>
);

export const IconeNova = () => (
  <svg {...contorno}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
);

export const IconeAdmin = () => (
  <svg {...contorno}><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" /></svg>
);

export const IconeSair = () => (
  <svg {...contorno}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
);
