import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Zap } from 'lucide-react';

const INTRO_DURATION_MS = 2400;

const makeIntroCube = (className, delay) => ({
  className,
  initial: { opacity: 0, y: 42, rotateX: -20, scale: 0.78 },
  animate: { opacity: 1, y: 0, rotateX: 0, scale: 1 },
  transition: { duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] },
});

const IntroScreen = ({ onComplete }) => {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const finish = () => {
      try {
        sessionStorage.setItem('relay_intro_seen', 'true');
      } catch {
        // Intro timing should not depend on session storage availability.
      }
      setVisible(false);
      onComplete();
    };

    if (reduceMotion) {
      finish();
      return undefined;
    }

    const timer = window.setTimeout(finish, INTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  const topCube = makeIntroCube('intro-cube intro-cube-top', 0.12);
  const leftCube = makeIntroCube('intro-cube intro-cube-left', 0.25);
  const rightCube = makeIntroCube('intro-cube intro-cube-right', 0.38);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="intro-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.025, filter: 'blur(8px)' }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          aria-label="Relay Workflow Engine intro"
          role="status"
        >
          <div className="intro-orbit intro-orbit-one" />
          <div className="intro-orbit intro-orbit-two" />
          <div className="intro-grid" />
          <div className="intro-content">
            <div className="intro-cube-cluster" aria-hidden="true">
              {[topCube, leftCube, rightCube].map(({ className, ...animation }) => (
                <motion.div key={className} className={className} {...animation}>
                  <svg viewBox="0 0 120 110" aria-hidden="true">
                    <path d="M60 4 112 31 60 58 8 31 60 4Z" />
                    <path d="M8 31v50l52 25V58L8 31Z" />
                    <path d="M112 31v50l-52 25V58l52-27Z" />
                  </svg>
                </motion.div>
              ))}
              <motion.div
                className="intro-core"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: [0.5, 1.15, 1] }}
                transition={{ delay: 0.75, duration: 0.65 }}
              >
                <Zap size={24} fill="currentColor" />
              </motion.div>
            </div>
            <motion.div
              className="intro-wordmark"
              initial={{ opacity: 0, y: 18, letterSpacing: '0.2em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '-0.055em' }}
              transition={{ delay: 0.72, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              Relay
            </motion.div>
            <motion.div
              className="intro-subtitle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.92, duration: 0.55 }}
            >
              WORKFLOW ENGINE
            </motion.div>
            <motion.div
              className="intro-caption"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.15, duration: 0.6 }}
            >
              Human decisions. Reliable automation.
            </motion.div>
          </div>
          <div className="intro-footer">
            <span className="intro-status-dot" />
            <span>Orchestrating your workspace</span>
            <div className="intro-progress"><span /></div>
          </div>
          <button
            className="intro-skip"
            onClick={() => {
              try {
                sessionStorage.setItem('relay_intro_seen', 'true');
              } catch {
                // Continue into the app even if session storage is unavailable.
              }
              setVisible(false);
              onComplete();
            }}
            type="button"
          >
            Skip intro
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroScreen;
