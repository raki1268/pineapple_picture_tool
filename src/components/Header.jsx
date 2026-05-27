export default function Header() {
  return (
    <header className="header">
      <svg className="header-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 40 C44 28 32 16 38 6 C41 1 47 10 50 20 C53 10 59 1 62 6 C68 16 56 28 50 40Z" fill="#5B9E6A"/>
        <path d="M50 40 C40 22 25 14 22 4 C25 1 34 8 43 19 C39 5 37 -3 42 0 C47 3 50 24 50 40Z" fill="#7DB87D"/>
        <path d="M50 40 C60 22 75 14 78 4 C75 1 66 8 57 19 C61 5 63 -3 58 0 C53 3 50 24 50 40Z" fill="#7DB87D"/>
        <ellipse cx="50" cy="70" rx="27" ry="28" fill="#F5C518"/>
        <line x1="23" y1="56" x2="77" y2="56" stroke="#D4A200" strokeWidth="1.5"/>
        <line x1="23" y1="70" x2="77" y2="70" stroke="#D4A200" strokeWidth="1.5"/>
        <line x1="23" y1="84" x2="77" y2="84" stroke="#D4A200" strokeWidth="1.5"/>
        <line x1="36" y1="44" x2="36" y2="96" stroke="#D4A200" strokeWidth="1.5"/>
        <line x1="50" y1="40" x2="50" y2="98" stroke="#D4A200" strokeWidth="1.5"/>
        <line x1="64" y1="44" x2="64" y2="96" stroke="#D4A200" strokeWidth="1.5"/>
      </svg>
      <span className="header-title">Pineapple Picture Tool</span>
      <span className="header-sub">client-side · no uploads · open source</span>
    </header>
  );
}
