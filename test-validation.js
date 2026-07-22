const express = require('express');
const { validationResult } = require('express-validator');
const { validateCreateUser } = require('./src/validations/userValidation');

const app = express();
app.use(express.json());

app.post('/test', validateCreateUser, (req, res) => {
  const errors = validationResult(req);
  res.json({
    valid: errors.isEmpty(),
    errors: errors.array()
  });
});

const server = app.listen(0, async () => {
  const port = server.address().port;
  const payload = {
    employeeId: "10",
    firstName: "Saisri",
    lastName: "Dasari",
    email: "saisri@gmail.com",
    mobile: "9959029186",
    password: "Password123!",
    gender: "FEMALE",
    role: "DOCTOR",
    department: "Cardiology",
    branch: "Main Branch"
  };

  const response = await fetch(`http://localhost:${port}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  console.log("RESULT for valid password:", JSON.stringify(result, null, 2));

  server.close();
});
