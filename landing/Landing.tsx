import { ThemeToggle } from '../shared/ThemeToggle'
import { FanCredit } from '../shared/FanCredit'
import { ArrowRight, Check, Layers3, LibraryBig, ListChecks } from 'lucide-react'

const CARDS = [
  { name: 'Stitch', version: 'Rock Star', ink: 'amber', image: 'crd_1135ff76d7504441942b3f9e9edae58d', quantity: 2 },
  { name: 'Elsa', version: 'Spirit of Winter', ink: 'amethyst', image: 'crd_cbc18e77d7ec4d50bf19650a9a559686', quantity: 1 },
  { name: 'Genie', version: 'On the Job', ink: 'emerald', image: 'crd_e910a64a2c12444e9eb34bab151b0428', quantity: 3 },
  { name: 'Mickey Mouse', version: 'Brave Little Tailor', ink: 'ruby', image: 'crd_e74ef94562b9440e8dd95ada098728d6', quantity: 1 },
  { name: 'Belle', version: 'Strange but Special', ink: 'sapphire', image: 'crd_63c2ca66eeea417b9079d833e0fd88d4', quantity: 1 },
  { name: 'Tinker Bell', version: 'Giant Fairy', ink: 'steel', image: 'crd_a77ba07844374c399becfa3d49262642', quantity: 2 },
]
const base = import.meta.env.BASE_URL
const collection = `${base}collection/`
const image = (id: string) => `https://cards.lorcast.io/card/digital/full/${id}.jpg`
const OpenCollection = ({ text = 'Abrir mi colección' }: { text?: string }) => <a className="button" href={collection}>{text}<ArrowRight aria-hidden="true" /></a>

export function Landing() {
  return <div className="site">
    <div className="ink-atmosphere" aria-hidden="true">
      <span className="ink-cloud amethyst" />
      <span className="ink-cloud sapphire" />
      <span className="ink-cloud amber" />
      <span className="ink-current" />
    </div>
    <header className="site-header">
      <a className="site-brand" href={base} aria-label="MiTinta, inicio"><img src={`${base}ink-icons/amethyst.png`} alt="" width="28" height="28" />MiTinta</a>
      <nav aria-label="Navegación principal"><a href="#funciones">Funciones</a><a href={`${base}privacy/`}>Privacidad</a></nav>
      <div className="header-actions"><ThemeToggle /><a className="button small" href={collection}>Abrir colección<ArrowRight aria-hidden="true" /></a></div>
    </header>
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Tu mundo Lorcana.<br /><span>Todo en su sitio.</span></h1>
        <p>Tu colección, las cartas que te faltan y tu próximo mazo.<br className="desktop-break" /> Un espacio para disfrutar de lo que coleccionas.</p>
        <div className="hero-actions"><OpenCollection /><a className="text-link" href="#funciones">Descubrir MiTinta</a></div>
        <div className="collection-preview" aria-label="Ejemplo ilustrativo de una colección con cartas reales">
          <div className="preview-heading"><span><Layers3 aria-hidden="true" />Mi colección</span><span className="preview-example">Ejemplo de colección</span></div>
          <div className="preview-cards">{CARDS.map((card, index) => <article key={card.image}>
            <img className="preview-card-image" src={image(card.image)} alt={`${card.name} — ${card.version}`} width="252" height="352" fetchPriority={index < 3 ? 'high' : 'auto'} />
            <div className="preview-card-copy"><div><strong>{card.name}</strong><span>{card.version}</span></div><img src={`${base}ink-icons/${card.ink}.png`} alt="" width="23" height="23" /></div>
            <span className="preview-quantity">{card.quantity} {card.quantity === 1 ? 'copia' : 'copias'}</span>
          </article>)}</div>
        </div>
      </section>
      <section className="features" id="funciones" aria-labelledby="features-title">
        <div className="section-intro"><h2 id="features-title">Menos buscar.<br />Más disfrutar.</h2><p>De la primera carta al siguiente mazo, encuentra lo que necesitas en un mismo lugar.</p></div>
        <div className="feature-row"><div className="feature-copy"><Layers3 aria-hidden="true" /><h3>Una colección<br />que se entiende.</h3><p>Revisa tus cartas o recorre tus sets. Consulta el progreso, distingue las copias normales y foil y encuentra lo que te falta.</p><a className="text-link" href={collection}>Ver mi colección<ArrowRight aria-hidden="true" /></a></div><div className="set-demo" aria-label="Ejemplo ilustrativo de un set"><div><img src={`${base}ink-icons/amethyst.png`} alt="" /><span>The First Chapter</span></div><h4>Cada carta cuenta.</h4><p>Tu progreso, de un vistazo.</p><div className="set-demo-cards">{CARDS.slice(1, 4).map(card => <img key={card.image} src={image(card.image)} alt={`${card.name} — ${card.version}`} width="126" height="176" loading="lazy" />)}</div><span className="demo-label">Ejemplo ilustrativo</span></div></div>
        <div className="feature-row reverse"><div className="feature-copy"><LibraryBig aria-hidden="true" /><h3>La carta que buscas.<br />Sin dar vueltas.</h3><p>Explora el catálogo por nombre, tinta, rareza o coste. Consulta tus copias y los precios orientativos en euros de Cardmarket.</p><a className="text-link" href={collection}>Explorar el catálogo<ArrowRight aria-hidden="true" /></a></div><div className="catalog-demo"><div className="demo-search">Buscar en el catálogo<span>Elsa</span></div><img src={image(CARDS[1].image)} alt="Elsa — Spirit of Winter" width="252" height="352" loading="lazy" /><span className="demo-label">Cartas reales. Ejemplo ilustrativo.</span></div></div>
        <div className="feature-row"><div className="feature-copy"><ListChecks aria-hidden="true" /><h3>Tu próximo mazo<br />empieza aquí.</h3><p>Construye con tus cartas, comprueba las copias disponibles y comparte tu mazo. Importa listas y exporta tus faltantes a Cardmarket o tu colección a Dreamborn.</p><a className="text-link" href={collection}>Abrir mis mazos<ArrowRight aria-hidden="true" /></a></div><div className="deck-demo"><h4>Un lugar para tus ideas.</h4>{CARDS.slice(0, 3).map(card => <div className="demo-deck-row" key={card.image}><img src={image(card.image)} alt="" width="40" height="56" loading="lazy" /><div><strong>{card.name}</strong><span>{card.version}</span></div><span>×{card.quantity}</span></div>)}<span className="demo-label">Ejemplo ilustrativo de una lista de cartas</span></div></div>
      </section>
      <section className="quiet-section" aria-labelledby="android-title"><h2 id="android-title">En la mesa y donde estés.</h2><p>Escanea en Android y consulta tu colección en la web.<br />El reconocimiento ocurre en el móvil: la imagen de la cámara no se guarda ni se envía.</p><span className="availability">Android · Próximamente en Google Play</span></section>
      <section className="closing" aria-labelledby="closing-title"><h2 id="closing-title">Haz sitio a tu colección.</h2><p>Gratis, sin anuncios ni suscripciones.</p><OpenCollection /><span><Check aria-hidden="true" />Cuenta por correo. Tus cartas, sincronizadas.</span></section>
    </main>
    <footer className="site-footer"><div><a className="site-brand" href={base}>MiTinta</a><a href={`${base}privacy/`}>Política de privacidad</a></div><p>Las imágenes de cartas proceden de Lorcast. Las colecciones y listas mostradas son ejemplos ilustrativos.</p><FanCredit /></footer>
  </div>
}
