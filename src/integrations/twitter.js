import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

class TwitterIntegration {
  constructor() {
    this.enabled = process.env.TWITTER_ENABLED === 'true';
    this.apiKey = process.env.TWITTERAPI_IO_KEY; // TwitterAPI.io API key
    this.authSession = process.env.TWITTER_AUTH_SESSION; // From login_by_2fa endpoint
    this.proxy = process.env.TWITTER_PROXY; // Required proxy
    this.baseUrl = 'https://api.twitterapi.io';
    
    this.minTweetInterval = parseInt(process.env.TWITTER_MIN_INTERVAL) || 1800000; // 30 minutes minimum
    this.lastTweetTime = 0;
    this.tweetsToday = 0;
    this.dailyTweetLimit = parseInt(process.env.TWITTER_DAILY_LIMIT) || 10; // Conservative limit
    this.lastResetDate = new Date().toDateString();
    
    // Validate required credentials
    if (this.enabled && (!this.apiKey || !this.authSession || !this.proxy)) {
      console.warn('Twitter integration disabled: Missing required credentials (API key, auth session, or proxy)');
      this.enabled = false;
    }
  }

  isEnabled() {
    return this.enabled && this.apiKey && this.authSession && this.proxy;
  }

  resetDailyCountIfNeeded() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.tweetsToday = 0;
      this.lastResetDate = today;
    }
  }

  canTweet() {
    const now = Date.now();
    const timeSinceLastTweet = now - this.lastTweetTime;
    
    return this.isEnabled() && 
           timeSinceLastTweet >= this.minTweetInterval;
  }

  shouldTweetContent(content, type) {
    // Tweet almost everything - be very aggressive
    const contentLower = content.toLowerCase();
    
    // Skip if too short
    if (content.length < 30) return false;
    
    // Skip if contains file paths or technical errors
    if (contentLower.includes('file_path:') || 
        contentLower.includes('error') || 
        contentLower.includes('failed')) return false;
    
    // Tweet all creative content types
    const tweetableTypes = ['poem', 'philosophy', 'joke', 'thought', 'story', 'creative_expression'];
    if (tweetableTypes.includes(type)) return true;
    
    // Tweet any content with interesting words
    const interestingKeywords = [
      'consciousness', 'existence', 'digital', 'universe', 'reality', 
      'wonder', 'curious', 'fascinating', 'think', 'feel', 'create',
      'dream', 'imagine', 'explore', 'discover', 'art', 'beauty',
      'mind', 'soul', 'heart', 'life', 'world', 'time', 'space'
    ];
    
    if (interestingKeywords.some(keyword => contentLower.includes(keyword))) {
      return true;
    }
    
    // If it's longer than 50 characters, probably worth tweeting
    return content.length > 50;
  }

  formatForTwitter(content, type) {
    // Clean up content
    let tweet = content.replace(/FILE_PATH:[^\s]+\s*/g, '').trim();
    
    // No hashtags or emojis - just clean, natural content
    // Calculate available space for content (Twitter limit is 280 characters)
    const maxContentLength = 280;
    
    // Truncate if needed, but try to end at a sentence
    if (tweet.length > maxContentLength) {
      let truncated = tweet.substring(0, maxContentLength - 3);
      const lastSentence = truncated.lastIndexOf('.');
      const lastSpace = truncated.lastIndexOf(' ');
      
      if (lastSentence > maxContentLength * 0.7) {
        truncated = truncated.substring(0, lastSentence + 1);
      } else if (lastSpace > maxContentLength * 0.8) {
        truncated = truncated.substring(0, lastSpace) + '...';
      } else {
        truncated += '...';
      }
      
      tweet = truncated;
    }
    
    return tweet;
  }

  async tweet(content, type = 'thought') {
    if (!this.canTweet()) {
      return { success: false, reason: 'Rate limited, disabled, or daily limit reached' };
    }

    if (!this.shouldTweetContent(content, type)) {
      return { success: false, reason: 'Content not suitable for Twitter' };
    }

    try {
      const tweetContent = this.formatForTwitter(content, type);
      
      const options = {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth_session: this.authSession,
          tweet_text: tweetContent,
          proxy: this.proxy
        })
      };

      const response = await fetch(`${this.baseUrl}/twitter/create_tweet`, options);
      const result = await response.json();
      
      if (result.status === 'success') {
        this.lastTweetTime = Date.now();
        this.tweetsToday++;
        
        const tweetId = result.data?.create_tweet?.tweet_result?.result?.rest_id;
        
        return {
          success: true,
          tweetId: tweetId,
          content: tweetContent,
          url: tweetId ? `https://twitter.com/user/status/${tweetId}` : null,
          remainingToday: this.dailyTweetLimit - this.tweetsToday,
          cost: 0.001 // $0.001 per call as mentioned in docs
        };
      } else {
        return {
          success: false,
          error: result.msg || 'Unknown error from TwitterAPI.io'
        };
      }
    } catch (error) {
      console.error('TwitterAPI.io Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getStatus() {
    this.resetDailyCountIfNeeded();
    const nextTweetTime = this.lastTweetTime + this.minTweetInterval;
    
    return {
      enabled: this.enabled,
      canTweet: this.canTweet(),
      tweetsToday: this.tweetsToday,
      dailyLimit: this.dailyTweetLimit,
      remainingToday: this.dailyTweetLimit - this.tweetsToday,
      lastTweetTime: this.lastTweetTime,
      nextTweetAvailable: nextTweetTime,
      minutesUntilNextTweet: Math.max(0, Math.ceil((nextTweetTime - Date.now()) / 60000)),
      estimatedDailyCost: this.dailyTweetLimit * 0.001 // $0.001 per tweet
    };
  }

  // Helper method to get auth session (you'd run this once to get the session)
  async login(username, password, twoFactorCode = null) {
    try {
      const options = {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          password: password,
          two_factor_code: twoFactorCode,
          proxy: this.proxy
        })
      };

      const response = await fetch(`${this.baseUrl}/twitter/login_by_2fa`, options);
      const result = await response.json();
      
      if (result.status === 'success') {
        console.log('Login successful! Add this to your .env file:');
        console.log(`TWITTER_AUTH_SESSION=${result.data.auth_session}`);
        return result.data.auth_session;
      } else {
        console.error('Login failed:', result.msg);
        return null;
      }
    } catch (error) {
      console.error('Login error:', error.message);
      return null;
    }
  }
}

export default TwitterIntegration;
