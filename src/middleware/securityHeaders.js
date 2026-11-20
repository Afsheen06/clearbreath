import helmet from 'helmet';

/** Creates the configured security headers middleware.
 * @returns {import('express').RequestHandler} Helmet middleware.
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        manifestSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  });
}
