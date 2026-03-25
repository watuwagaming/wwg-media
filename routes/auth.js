const express = require('express');
const router = express.Router();

// With Clerk, login/register are handled by Clerk's hosted pages.
// These routes just handle the post-auth redirect and logout.

// After Clerk sign-in, sync user and redirect home
router.get('/callback', (req, res) => {
  res.redirect('/');
});

// Legacy logout route kept for any old links
router.post('/logout', (req, res) => {
  res.redirect('/sign-out');
});

module.exports = router;
