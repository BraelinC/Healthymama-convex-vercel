import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | HealthyMama',
  description: 'Privacy Policy for HealthyMama - Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          {/* Table of Contents */}
          <div className="bg-muted/50 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4 mt-0">Table of Contents</h2>
            <ol className="space-y-2 list-decimal list-inside mb-0">
              <li><a href="#introduction" className="text-primary hover:underline">Introduction</a></li>
              <li><a href="#information-we-collect" className="text-primary hover:underline">Information We Collect</a></li>
              <li><a href="#third-party-services" className="text-primary hover:underline">Third-Party Services</a></li>
              <li><a href="#pinterest-integration" className="text-primary hover:underline">Pinterest Integration</a></li>
              <li><a href="#how-we-use-information" className="text-primary hover:underline">How We Use Your Information</a></li>
              <li><a href="#data-sharing" className="text-primary hover:underline">Data Sharing and Disclosure</a></li>
              <li><a href="#your-rights" className="text-primary hover:underline">Your Privacy Rights</a></li>
              <li><a href="#data-retention" className="text-primary hover:underline">Data Retention</a></li>
              <li><a href="#security" className="text-primary hover:underline">Security</a></li>
              <li><a href="#cookies" className="text-primary hover:underline">Cookies and Tracking</a></li>
              <li><a href="#children" className="text-primary hover:underline">Children's Privacy</a></li>
              <li><a href="#changes" className="text-primary hover:underline">Changes to This Policy</a></li>
              <li><a href="#contact" className="text-primary hover:underline">Contact Us</a></li>
            </ol>
          </div>

          {/* Introduction */}
          <section id="introduction">
            <h2>1. Introduction</h2>
            <p>
              Welcome to HealthyMama ("we," "our," or "us"). We are committed to protecting your privacy and ensuring transparency about how we collect, use, and safeguard your personal information.
            </p>
            <p>
              HealthyMama is a meal planning and recipe platform that helps you discover recipes, plan meals, create grocery lists, and connect with cooking communities. This Privacy Policy explains our practices regarding your personal data when you use our website and services.
            </p>
            <p>
              By using HealthyMama, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
            </p>
          </section>

          {/* Information We Collect */}
          <section id="information-we-collect">
            <h2>2. Information We Collect</h2>

            <h3>2.1 Information You Provide to Us</h3>
            <p>We collect information that you voluntarily provide when using our services:</p>
            <ul>
              <li><strong>Account Information:</strong> Email address, name, and authentication credentials</li>
              <li><strong>Profile Information:</strong> Dietary preferences, restrictions, cultural background, cooking goals, and profile customization</li>
              <li><strong>User Content:</strong> Recipes you create or save, meal plans, grocery lists, community posts, and comments</li>
              <li><strong>Recipe URLs:</strong> Instagram URLs or other recipe sources you provide for import</li>
              <li><strong>Payment Information:</strong> Processed securely through Stripe (we do not store your credit card details)</li>
              <li><strong>Communications:</strong> Messages sent through our chat features, feedback, and support inquiries</li>
            </ul>

            <h3>2.2 Automatically Collected Information</h3>
            <ul>
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent, and interaction patterns</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
              <li><strong>Cookies and Tracking:</strong> Session data, authentication tokens, and preferences</li>
            </ul>

            <h3>2.3 AI-Generated Data</h3>
            <ul>
              <li><strong>Conversation History:</strong> Your interactions with our AI chat assistant</li>
              <li><strong>Learned Preferences:</strong> AI-analyzed patterns from your recipe interactions and meal planning behaviors</li>
              <li><strong>Recipe Embeddings:</strong> Machine learning representations of recipes for personalized recommendations</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section id="third-party-services">
            <h2>3. Third-Party Services</h2>
            <p>
              HealthyMama integrates with several third-party services to provide our features. These services may collect and process your data according to their own privacy policies:
            </p>

            <h3>3.1 Authentication and User Management</h3>
            <ul>
              <li>
                <strong>Clerk:</strong> We use Clerk for user authentication and account management. Clerk processes your email address, name, and authentication credentials.
                <br />
                <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Clerk Privacy Policy
                </a>
              </li>
            </ul>

            <h3>3.2 Payment Processing</h3>
            <ul>
              <li>
                <strong>Stripe:</strong> All payment transactions for community subscriptions are processed through Stripe. We store only your Stripe customer ID; Stripe handles all payment card information securely.
                <br />
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Stripe Privacy Policy
                </a>
              </li>
            </ul>

            <h3>3.3 Artificial Intelligence Services</h3>
            <ul>
              <li>
                <strong>OpenAI:</strong> Powers recipe generation, chat assistance, and content analysis. Your prompts and interactions may be processed by OpenAI.
                <br />
                <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  OpenAI Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google AI (Gemini):</strong> Used for recipe extraction from URLs and images, ingredient analysis, and content processing.
                <br />
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <strong>xAI:</strong> Alternative AI provider for recipe processing and chat features.
              </li>
              <li>
                <strong>OpenRouter:</strong> AI routing service that may process your requests across multiple AI providers.
                <br />
                <a href="https://openrouter.ai/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  OpenRouter Privacy Policy
                </a>
              </li>
              <li>
                <strong>ElevenLabs:</strong> Provides voice assistant and conversational AI features. Audio interactions and transcriptions are processed through ElevenLabs.
                <br />
                <a href="https://elevenlabs.io/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  ElevenLabs Privacy Policy
                </a>
              </li>
            </ul>

            <h3>3.4 Content and Media Services</h3>
            <ul>
              <li>
                <strong>Mux:</strong> Video hosting and streaming service for recipe videos imported from Instagram and other sources.
                <br />
                <a href="https://www.mux.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Mux Privacy Policy
                </a>
              </li>
              <li>
                <strong>Instagram (via HikerAPI):</strong> When you import recipe videos from Instagram, we extract publicly available content using third-party APIs. We only process URLs you explicitly provide.
              </li>
            </ul>

            <h3>3.5 Shopping Integration</h3>
            <ul>
              <li>
                <strong>Instacart:</strong> Powers the "Shop Ingredients" feature. When you use this feature, your grocery list may be shared with Instacart.
                <br />
                <a href="https://www.instacart.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Instacart Privacy Policy
                </a>
              </li>
            </ul>

            <h3>3.6 Feedback and Analytics</h3>
            <ul>
              <li>
                <strong>UserJot:</strong> Collects user feedback, feature requests, and optional screenshots when you submit feedback through our feedback widget.
                <br />
                <a href="https://userjot.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  UserJot Privacy Policy
                </a>
              </li>
            </ul>

            <h3>3.7 Infrastructure and Hosting</h3>
            <ul>
              <li>
                <strong>Convex:</strong> Our real-time database that stores all user data, recipes, preferences, and application state.
                <br />
                <a href="https://www.convex.dev/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Convex Privacy Policy
                </a>
              </li>
              <li>
                <strong>Vercel:</strong> Hosts our frontend application and API routes.
                <br />
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Vercel Privacy Policy
                </a>
              </li>
              <li>
                <strong>DigitalOcean:</strong> Hosts our Instagram scraping service infrastructure.
                <br />
                <a href="https://www.digitalocean.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  DigitalOcean Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          {/* Pinterest Integration */}
          <section id="pinterest-integration">
            <h2>4. Pinterest Integration</h2>
            <p>
              If you choose to connect your Pinterest account or share recipes to Pinterest, the following applies:
            </p>
            <ul>
              <li>
                <strong>Pinterest API:</strong> We may use Pinterest's API to enable recipe sharing, saving pins, or discovering content. Any data exchanged with Pinterest is governed by Pinterest's Privacy Policy.
              </li>
              <li>
                <strong>Data Shared:</strong> When you share a recipe to Pinterest, we share the recipe title, description, image, and link to the recipe page.
              </li>
              <li>
                <strong>Pinterest Account Data:</strong> If you connect your Pinterest account, we may access your public profile information and boards as permitted by Pinterest's API and your authorization.
              </li>
              <li>
                <strong>Control:</strong> You can disconnect your Pinterest account at any time from your HealthyMama settings.
              </li>
            </ul>
            <p>
              <a href="https://policy.pinterest.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View Pinterest's Privacy Policy
              </a>
            </p>
          </section>

          {/* How We Use Information */}
          <section id="how-we-use-information">
            <h2>5. How We Use Your Information</h2>
            <p>We use the collected information for the following purposes:</p>
            <ul>
              <li><strong>Provide Services:</strong> Create and manage your account, enable recipe saving, meal planning, and grocery list features</li>
              <li><strong>Personalization:</strong> Use AI to learn your preferences and provide personalized recipe recommendations</li>
              <li><strong>AI Features:</strong> Power our chat assistant, recipe extraction, and intelligent search capabilities</li>
              <li><strong>Community Features:</strong> Enable you to join communities, share recipes, and interact with other users</li>
              <li><strong>Payment Processing:</strong> Process subscription payments for paid community memberships</li>
              <li><strong>Communication:</strong> Send service updates, respond to inquiries, and provide customer support</li>
              <li><strong>Improvement:</strong> Analyze usage patterns to improve our platform and develop new features</li>
              <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security issues</li>
              <li><strong>Legal Compliance:</strong> Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section id="data-sharing">
            <h2>6. Data Sharing and Disclosure</h2>
            <p>We do not sell your personal information. We may share your data in the following circumstances:</p>
            <ul>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information (e.g., sharing to Pinterest)</li>
              <li><strong>Service Providers:</strong> With third-party services listed in Section 3 that help us operate our platform</li>
              <li><strong>Community Content:</strong> Recipes and posts you share in public communities are visible to other community members</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>Protection:</strong> To protect our rights, safety, and property, or that of our users and the public</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section id="your-rights">
            <h2>7. Your Privacy Rights</h2>
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>

            <h3>7.1 General Rights</h3>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Update or correct inaccurate personal information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data ("right to be forgotten")</li>
              <li><strong>Data Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to certain processing of your personal data</li>
              <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
            </ul>

            <h3>7.2 GDPR Rights (EU/EEA Users)</h3>
            <p>
              If you are in the European Economic Area, you have additional rights under the General Data Protection Regulation (GDPR), including the right to lodge a complaint with your local supervisory authority.
            </p>

            <h3>7.3 CCPA Rights (California Users)</h3>
            <p>
              California residents have specific rights under the California Consumer Privacy Act (CCPA), including:
            </p>
            <ul>
              <li>Right to know what personal information is collected</li>
              <li>Right to know if personal information is sold or disclosed</li>
              <li>Right to opt-out of sale of personal information (we do not sell personal information)</li>
              <li>Right to deletion of personal information</li>
              <li>Right to non-discrimination for exercising CCPA rights</li>
            </ul>

            <h3>7.4 Exercising Your Rights</h3>
            <p>
              To exercise any of these rights, please contact us at <a href="mailto:Healthymamahub@gmail.com" className="text-primary hover:underline">Healthymamahub@gmail.com</a>. We will respond to your request within 30 days.
            </p>
          </section>

          {/* Data Retention */}
          <section id="data-retention">
            <h2>8. Data Retention</h2>
            <p>We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy:</p>
            <ul>
              <li><strong>Active Accounts:</strong> We retain data while your account is active</li>
              <li><strong>Account Deletion:</strong> When you delete your account, we remove your personal data within 90 days, except as required for legal compliance</li>
              <li><strong>Backups:</strong> Data in backups may persist for up to 90 days after deletion</li>
              <li><strong>Legal Obligations:</strong> Some data may be retained longer to comply with legal, tax, or regulatory requirements</li>
              <li><strong>Aggregated Data:</strong> We may retain anonymized, aggregated data indefinitely for analytics</li>
            </ul>
          </section>

          {/* Security */}
          <section id="security">
            <h2>9. Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information:
            </p>
            <ul>
              <li><strong>Encryption:</strong> Data is encrypted in transit using HTTPS/TLS and at rest where applicable</li>
              <li><strong>Authentication:</strong> Secure authentication through Clerk with industry-standard protocols</li>
              <li><strong>Access Controls:</strong> Limited access to personal data on a need-to-know basis</li>
              <li><strong>Payment Security:</strong> PCI-compliant payment processing through Stripe</li>
              <li><strong>Regular Audits:</strong> Ongoing security assessments and updates</li>
            </ul>
            <p>
              However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          {/* Cookies */}
          <section id="cookies">
            <h2>10. Cookies and Tracking Technologies</h2>
            <p>We use cookies and similar tracking technologies to:</p>
            <ul>
              <li><strong>Authentication:</strong> Keep you logged in and manage your session</li>
              <li><strong>Preferences:</strong> Remember your settings and preferences</li>
              <li><strong>Analytics:</strong> Understand how you use our platform</li>
              <li><strong>Performance:</strong> Monitor and improve platform performance</li>
            </ul>
            <p>
              You can control cookies through your browser settings. Disabling cookies may limit some functionality of our services.
            </p>
          </section>

          {/* Children's Privacy */}
          <section id="children">
            <h2>11. Children's Privacy</h2>
            <p>
              HealthyMama is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at <a href="mailto:Healthymamahub@gmail.com" className="text-primary hover:underline">Healthymamahub@gmail.com</a>, and we will delete that information.
            </p>
            <p>
              If you are under 18, please obtain parental consent before using our services or providing any personal information.
            </p>
          </section>

          {/* Changes */}
          <section id="changes">
            <h2>12. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of any material changes by:
            </p>
            <ul>
              <li>Posting the updated policy on this page with a new "Last Updated" date</li>
              <li>Sending an email notification to your registered email address (for significant changes)</li>
              <li>Displaying a notice on our platform</li>
            </ul>
            <p>
              Your continued use of HealthyMama after any changes indicates your acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* Contact */}
          <section id="contact">
            <h2>13. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-muted/50 p-6 rounded-lg my-6">
              <p className="mb-2"><strong>HealthyMama</strong></p>
              <p className="mb-2">
                Email: <a href="mailto:Healthymamahub@gmail.com" className="text-primary hover:underline">Healthymamahub@gmail.com</a>
              </p>
              <p className="mb-0">
                Privacy Policy Page: <a href="https://healthymama.app/privacy" className="text-primary hover:underline">healthymama.app/privacy</a>
              </p>
            </div>
            <p>
              We will respond to your inquiry as promptly as possible, typically within 30 days.
            </p>
          </section>

          {/* Footer */}
          <div className="border-t border-border pt-8 mt-12 text-center text-sm text-muted-foreground">
            <p>
              This Privacy Policy is effective as of the date listed at the top of this page.
            </p>
            <p className="mt-2">
              © {new Date().getFullYear()} HealthyMama. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
