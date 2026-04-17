import './HomePage.css';
import { Link } from 'react-router-dom';
import { Briefcase, Star, ShieldCheck, MapPin, Clock, Users, ArrowRight, Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  const userEmoji = "\uD83D\uDC64";
  const starsEmoji = "\u2B50".repeat(5);
  const facebookEmoji = "\uD83D\uDC99";
  const instagramEmoji = "\uD83D\uDCF8";
  const twitterEmoji = "\uD83D\uDCE3";

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="homepage">
      <motion.section
        className="hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-text">
            <motion.div
              className="hero-badge"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <ShieldCheck size={16} />
              <span>Plataforma 100% segura e verificada</span>
            </motion.div>
            <motion.h1
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Sua casa brilhando, <br />
              <span className="highlight">sem esforço.</span>
            </motion.h1>
            <motion.p
              className="hero-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Encontre os melhores profissionais de limpeza da sua região.
              Agendamento rápido, pagamento seguro e garantia de satisfação Limpaê.
            </motion.p>
            <motion.div
              className="hero-buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <Link className="btn-primary" to="/register">
                Agendar agora
                <ArrowRight size={20} />
              </Link>
              <button className="btn-secondary">
                <Play size={18} />
                Ver vídeo
              </button>
            </motion.div>
            <motion.div
              className="hero-trust"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
            >
              <div className="trust-avatars">
                <img src="https://i.pravatar.cc/40?u=1" alt="Usuário" />
                <img src="https://i.pravatar.cc/40?u=2" alt="Usuário" />
                <img src="https://i.pravatar.cc/40?u=3" alt="Usuário" />
                <div className="avatar-plus">+5k</div>
              </div>
              <p>Junte-se a mais de <strong>5.000 clientes</strong> satisfeitos.</p>
            </motion.div>
          </div>
          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="visual-container">
              <div className="main-card">
                <div className="card-header">
                  <div className="user-info">
                    <div className="user-img">{userEmoji}</div>
                    <div>
                      <h4>Maria Silva</h4>
                      <div className="rating">{starsEmoji} (128)</div>
                    </div>
                  </div>
                  <div className="price">R$ 150</div>
                </div>
                <div className="card-body">
                  <div className="tag">Limpeza residencial</div>
                  <div className="tag">Passadoria</div>
                </div>
                <button className="card-btn">Contratar</button>
              </div>
              <div className="floating-badge badge-1">
                <Star size={16} fill="#fbbf24" color="#fbbf24" />
                <span>Top diarista</span>
              </div>
              <div className="floating-badge badge-2">
                <Clock size={16} color="#2563eb" />
                <span>Hoje disponível</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="stats"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        <div className="primary-container">
          <div className="stats-grid">
            <motion.div className="stat-item" variants={fadeInUp}>
              <div className="stat-number">500+</div>
              <div className="stat-label">Diaristas ativas</div>
            </motion.div>
            <motion.div className="stat-item" variants={fadeInUp}>
              <div className="stat-number">2,000+</div>
              <div className="stat-label">Serviços realizados</div>
            </motion.div>
            <motion.div className="stat-item" variants={fadeInUp}>
              <div className="stat-number">4.9</div>
              <div className="stat-label">Avaliação média</div>
            </motion.div>
            <motion.div className="stat-item" variants={fadeInUp}>
              <div className="stat-number">15min</div>
              <div className="stat-label">Tempo médio de resposta</div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="features"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        <div className="primary-container">
          <motion.div className="section-header" variants={fadeInUp}>
            <h2>Por que escolher o Limpaê?</h2>
            <p>Uma plataforma completa para conectar você aos melhores profissionais.</p>
          </motion.div>

          <div className="features-grid">
            <motion.div className="feature-card" variants={fadeInUp}>
              <div className="feature-icon">
                <ShieldCheck size={32} />
              </div>
              <h3>Profissionais verificados</h3>
              <p>Todos os diaristas passam por um processo rigoroso de verificação e background check.</p>
            </motion.div>

            <motion.div className="feature-card" variants={fadeInUp}>
              <div className="feature-icon">
                <MapPin size={32} />
              </div>
              <h3>Localização inteligente</h3>
              <p>Encontre profissionais próximos a você com nosso sistema de geolocalização preciso.</p>
            </motion.div>

            <motion.div className="feature-card" variants={fadeInUp}>
              <div className="feature-icon">
                <Star size={32} />
              </div>
              <h3>Sistema de avaliações</h3>
              <p>Avaliações reais de clientes para garantir a qualidade dos serviços prestados.</p>
            </motion.div>

            <motion.div className="feature-card" variants={fadeInUp}>
              <div className="feature-icon">
                <Clock size={32} />
              </div>
              <h3>Agendamento flexível</h3>
              <p>Escolha o dia e o horário que melhor se adapta à sua rotina.</p>
            </motion.div>

            <motion.div className="feature-card" variants={fadeInUp}>
              <div className="feature-icon">
                <Briefcase size={32} />
              </div>
              <h3>Pagamento seguro</h3>
              <p>Múltiplas formas de pagamento com proteção total por meio do Stripe.</p>
            </motion.div>

            <motion.div className="feature-card" variants={fadeInUp}>
              <div className="feature-icon">
                <Users size={32} />
              </div>
              <h3>Suporte 24/7</h3>
              <p>Nossa equipe está sempre pronta para ajudar você e garantir sua satisfação.</p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="how-it-works"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        <div className="primary-container">
          <motion.div className="section-header" variants={fadeInUp}>
            <h2>Como funciona?</h2>
            <p>Em poucos passos, você já pode ter sua casa Limpaê.</p>
          </motion.div>

          <div className="steps-grid">
            <motion.div className="step-card" variants={fadeInUp}>
              <div className="step-number">01</div>
              <div className="step-content">
                <h3>Cadastre-se</h3>
                <p>Crie sua conta e adicione seus endereços de forma rápida e segura.</p>
              </div>
            </motion.div>

            <motion.div className="step-card" variants={fadeInUp}>
              <div className="step-number">02</div>
              <div className="step-content">
                <h3>Encontre profissionais</h3>
                <p>Navegue pelo mapa e veja diaristas disponíveis próximas à sua localização.</p>
              </div>
            </motion.div>

            <motion.div className="step-card" variants={fadeInUp}>
              <div className="step-number">03</div>
              <div className="step-content">
                <h3>Agende o serviço</h3>
                <p>Escolha a data, o horário e o tipo de serviço de que você precisa.</p>
              </div>
            </motion.div>

            <motion.div className="step-card" variants={fadeInUp}>
              <div className="step-number">04</div>
              <div className="step-content">
                <h3>Relaxe e aproveite</h3>
                <p>Acompanhe o serviço em tempo real e pague com segurança.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="testimonials"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
      >
        <div className="primary-container">
          <motion.div className="section-header" variants={fadeInUp}>
            <h2>O que nossos clientes dizem</h2>
            <p>Histórias reais de pessoas que transformaram suas rotinas.</p>
          </motion.div>

          <div className="testimonials-grid">
            <motion.div className="testimonial-card" variants={fadeInUp}>
              <div className="testimonial-content">
                <div className="stars">{starsEmoji}</div>
                <p>"Incrível! A Maria é uma profissional excepcional. Minha casa ficou impecável e o processo foi super fácil."</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{userEmoji}</div>
                  <div>
                    <div className="author-name">Ana Silva</div>
                    <div className="author-role">Cliente há 1 ano</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div className="testimonial-card" variants={fadeInUp}>
              <div className="testimonial-content">
                <div className="stars">{starsEmoji}</div>
                <p>"Como diarista, o Limpaê mudou minha vida. Agora tenho uma agenda cheia e renda estável."</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{userEmoji}</div>
                  <div>
                    <div className="author-name">João Santos</div>
                    <div className="author-role">Diarista verificado</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div className="testimonial-card" variants={fadeInUp}>
              <div className="testimonial-content">
                <div className="stars">{starsEmoji}</div>
                <p>"Praticidade e confiança em um só lugar. Recomendo para toda a minha família."</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{userEmoji}</div>
                  <div>
                    <div className="author-name">Carla Mendes</div>
                    <div className="author-role">Cliente há 6 meses</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="cta"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="primary-container">
          <div className="cta-content">
            <h2>Pronto para começar?</h2>
            <p>Junte-se a milhares de pessoas que já descobriram a praticidade do Limpaê.</p>
            <div className="cta-buttons">
              <Link className="btn-primary" to="/register">Cadastrar como cliente</Link>
              <Link className="btn-outline" to="/register">Trabalhar como diarista</Link>
            </div>
          </div>
        </div>
      </motion.section>

      <footer className="footer">
        <div className="primary-container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>Limpaê</h3>
              <p>Conectando pessoas por meio da limpeza profissional.</p>
            </div>
            <div className="footer-section">
              <h4>Links rápidos</h4>
              <ul>
                <li><Link to="/">Sobre nós</Link></li>
                <li><Link to="/">Central de ajuda</Link></li>
                <li><Link to="/">Termos de uso</Link></li>
                <li><Link to="/">Privacidade</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contato</h4>
              <p>suporte@diariaja.kinghost.net</p>
              <p>(11) 99999-9999</p>
            </div>
            <div className="footer-section">
              <h4>Redes sociais</h4>
              <div className="social-links">
                <button aria-label="Facebook" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>{facebookEmoji}</button>
                <button aria-label="Instagram" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>{instagramEmoji}</button>
                <button aria-label="Twitter" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>{twitterEmoji}</button>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Limpaê. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
