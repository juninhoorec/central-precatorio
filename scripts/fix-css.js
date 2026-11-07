const fs = require('fs');
const filePath = 'c:/Users/Junio Cavalcanti/Desktop/central precatorio/src/app/workspace/operations.module.css';
let css = fs.readFileSync(filePath, 'utf8');

css = css.replace(/@media\(max-width:1250px\)/g, '@media(max-width:768px)');
css = css.replace(/@media\(max-width:920px\)/g, '@media(max-width:768px)');
css = css.replace(/@media\(max-width:760px\)/g, '@media(max-width:640px)');

const splitIdx = css.indexOf('/* ==============================================================');
if (splitIdx !== -1) {
  css = css.slice(0, splitIdx).trim();
}

css = css.replace('grid-template-columns:230px minmax(0,1fr)', 'grid-template-columns:245px minmax(0,1fr)');

const newRules = [
  '',
  '/* ============================================================== */',
  '/* SIDEBAR FIXA PERMANENTE APROVADA (1055px E DESKTOPS)           */',
  '/* ============================================================== */',
  '.app {',
  '  display: grid !important;',
  '  grid-template-columns: 245px minmax(0, 1fr) !important;',
  '  min-height: 100vh !important;',
  '  width: 100% !important;',
  '  max-width: 100vw !important;',
  '  background: #f8fafc !important;',
  '  overflow-x: hidden !important;',
  '}',
  '',
  '.sidebar {',
  '  position: sticky !important;',
  '  top: 0 !important;',
  '  height: 100vh !important;',
  '  width: 245px !important;',
  '  background: #081726 !important;',
  '  color: #cbd5e1 !important;',
  '  padding: 20px 16px !important;',
  '  display: flex !important;',
  '  flex-direction: column !important;',
  '  gap: 16px !important;',
  '  overflow-y: auto !important;',
  '  border-right: 1px solid rgba(255, 255, 255, 0.08) !important;',
  '  z-index: 10 !important;',
  '}',
  '',
  '.main {',
  '  min-width: 0 !important;',
  '  width: 100% !important;',
  '  padding: 16px 20px !important;',
  '  overflow-y: auto !important;',
  '  overflow-x: hidden !important;',
  '}',
  '',
  '/* Somente smartphones pequenos (< 640px) recolhem a sidebar */',
  '@media (max-width: 640px) {',
  '  .app {',
  '    display: flex !important;',
  '    flex-direction: column !important;',
  '  }',
  '  .sidebar {',
  '    position: static !important;',
  '    width: 100% !important;',
  '    height: auto !important;',
  '    padding: 12px 14px !important;',
  '  }',
  '  .sidebar nav {',
  '    display: flex !important;',
  '    overflow-x: auto !important;',
  '  }',
  '}',
  ''
].join('\n');

css = css + '\n' + newRules;
fs.writeFileSync(filePath, css, 'utf8');
console.log('operations.module.css fixed successfully!');
