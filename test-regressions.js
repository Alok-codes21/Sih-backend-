import assert from 'node:assert/strict';
import { validate, schemas } from './middleware/validate.js';
import { ValidationError } from './middleware/errorHandler.js';

const runMiddleware = (middleware, req) => new Promise((resolve, reject) => {
  middleware(req, {}, (err) => err ? reject(err) : resolve(req));
});

const main = async () => {
  // Regression: Zod v4 exposes validation details through error.issues, not error.errors.
  await assert.rejects(
    () => runMiddleware(validate(schemas.login), { body: { email: 'not-an-email', password: '' } }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /Validation error:/);
      assert.match(error.message, /email/);
      assert.match(error.message, /Password is required/);
      return true;
    }
  );

  const req = { body: { email: 'athlete@example.com', password: 'strong-password' } };
  await runMiddleware(validate(schemas.login), req);
  assert.equal(req.body.email, 'athlete@example.com');

  console.log('Regression tests: 2 passed, 0 failed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
