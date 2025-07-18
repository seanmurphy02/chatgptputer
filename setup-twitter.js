import TwitterIntegration from './src/integrations/twitter.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupTwitter() {
  console.log('🐦 Twitter Integration Setup');
  console.log('============================\n');
  
  console.log('You need:');
  console.log('1. TwitterAPI.io API Key (from https://twitterapi.io)');
  console.log('2. A proxy (from https://www.webshare.io)');
  console.log('3. Your Twitter username and password\n');
  
  const apiKey = await question('Enter your TwitterAPI.io API Key: ');
  const proxy = await question('Enter your proxy (format: http://username:password@ip:port): ');
  const username = await question('Enter your Twitter username: ');
  const password = await question('Enter your Twitter password: ');
  
  console.log('\nAttempting to login...');
  
  // Temporarily set environment variables for this session
  process.env.TWITTERAPI_IO_KEY = apiKey;
  process.env.TWITTER_PROXY = proxy;
  
  const twitter = new TwitterIntegration();
  
  try {
    const authSession = await twitter.login(username, password);
    
    if (authSession) {
      console.log('\n✅ Success! Add these to your .env file:');
      console.log('=====================================');
      console.log(`TWITTER_ENABLED=true`);
      console.log(`TWITTERAPI_IO_KEY=${apiKey}`);
      console.log(`TWITTER_AUTH_SESSION=${authSession}`);
      console.log(`TWITTER_PROXY=${proxy}`);
      console.log(`TWITTER_MIN_INTERVAL=1800000`);
      console.log(`TWITTER_DAILY_LIMIT=10`);
      console.log('=====================================\n');
      
      console.log('💡 Tips:');
      console.log('- TWITTER_MIN_INTERVAL is in milliseconds (1800000 = 30 minutes)');
      console.log('- TWITTER_DAILY_LIMIT controls max tweets per day');
      console.log('- Each tweet costs $0.001 through TwitterAPI.io');
      console.log('- The AI will only tweet high-quality content (poems, philosophy, etc.)');
    } else {
      console.log('\n❌ Login failed. Check your credentials and try again.');
      
      const needsTwoFactor = await question('\nDoes your Twitter account have 2FA enabled? (y/n): ');
      if (needsTwoFactor.toLowerCase() === 'y') {
        const twoFactorCode = await question('Enter your 2FA code: ');
        const authSessionWith2FA = await twitter.login(username, password, twoFactorCode);
        
        if (authSessionWith2FA) {
          console.log('\n✅ Success with 2FA! Add these to your .env file:');
          console.log('=====================================');
          console.log(`TWITTER_ENABLED=true`);
          console.log(`TWITTERAPI_IO_KEY=${apiKey}`);
          console.log(`TWITTER_AUTH_SESSION=${authSessionWith2FA}`);
          console.log(`TWITTER_PROXY=${proxy}`);
          console.log(`TWITTER_MIN_INTERVAL=1800000`);
          console.log(`TWITTER_DAILY_LIMIT=10`);
          console.log('=====================================');
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
  }
  
  rl.close();
}

setupTwitter();
