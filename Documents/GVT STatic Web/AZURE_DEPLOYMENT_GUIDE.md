# AZURE DEPLOYMENT GUIDE
## Golden Valley Transit Website

═══════════════════════════════════════════════════════════════════

## 🚀 DEPLOYMENT OPTIONS

### ✅ RECOMMENDED: Azure Static Web Apps

**Best for:** Simple, fast deployment with free tier
**Cost:** FREE (includes 100 GB bandwidth/month)
**Time to deploy:** 10-15 minutes

---

## OPTION 1: AZURE STATIC WEB APPS (RECOMMENDED)

### Step-by-Step Deployment

#### **STEP 1: Access Azure Portal**

1. Go to: https://portal.azure.com
2. Sign in with your Microsoft account
3. If you don't have an Azure account, you can create one (free tier available)

#### **STEP 2: Create Static Web App**

1. In Azure Portal, click "Create a resource"
2. Search for "Static Web App"
3. Click "Create"

**Configuration:**
```
Subscription: [Your Azure Subscription]
Resource Group: [Create new] "GoldenValleyTransit-RG"
Name: "goldenvalleytransit" (or your preference)
Plan type: Free
Region: West US 2 (closest to California)
```

#### **STEP 3: Deployment Source**

You have two options:

**Option A: GitHub (Easier for updates)**
- Choose "GitHub" as source
- Authorize Azure to access your GitHub account
- Create new repository: "golden-valley-transit-website"
- Upload your website files to this repo
- Azure will auto-deploy from GitHub

**Option B: Manual Upload (Faster initial deployment)**
- Choose "Other" as source
- Click "Review + Create"
- After creation, upload files manually

#### **STEP 4: Upload Website Files**

If using Manual Upload:

1. After Static Web App is created, go to resource
2. Click "Browse" to see your site
3. Go to "Configuration" > "Application settings"
4. Upload your index.html file

**Using Azure CLI (if you have it installed):**
```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy --app-location ./website-deploy --output-location .
```

#### **STEP 5: Configure Custom Domain**

1. In Azure Portal, go to your Static Web App
2. Click "Custom domains" in left menu
3. Click "Add"
4. Enter your domain name
5. You'll receive DNS records to add:
   - CNAME record: `www` → `[your-app].azurestaticapps.net`
   - TXT record for verification

**Add these to your domain registrar:**
- Go to your domain provider (GoDaddy, Namecheap, etc.)
- Add DNS records as shown by Azure
- Wait 5-60 minutes for propagation
- Click "Validate" in Azure Portal

#### **STEP 6: SSL Certificate**

✅ **Automatic!** Azure provides free SSL certificate
- Certificate auto-provisions after domain validation
- HTTPS enabled automatically
- Auto-renewal handled by Azure

---

## OPTION 2: AZURE APP SERVICE

### When to use:
- Need backend API hosting alongside website
- Want more configuration control
- Need staging environments

### Pricing:
- **Free Tier:** Good for testing, has limitations
- **Basic B1:** $13/month - **RECOMMENDED**
- **Standard S1:** $70/month - For production scale

### Deployment Steps:

#### **STEP 1: Create App Service**

1. In Azure Portal, click "Create a resource"
2. Search for "App Service"
3. Click "Create" > "Web App"

**Configuration:**
```
Subscription: [Your Azure Subscription]
Resource Group: GoldenValleyTransit-RG
Name: goldenvalleytransit (creates goldenvalleytransit.azurewebsites.net)
Publish: Code
Runtime stack: PHP 8.0 or Node 18 LTS (either works for static site)
Operating System: Linux
Region: West US 2
Pricing: Basic B1 ($13/month) or Free F1 (for testing)
```

#### **STEP 2: Deploy Website**

**Method A: FTP Upload**
1. Go to your App Service in Azure Portal
2. Click "Deployment Center"
3. Get FTP credentials
4. Use FileZilla or any FTP client:
   - Host: [shown in Azure]
   - Username: [shown in Azure]
   - Password: [shown in Azure]
5. Upload index.html to /site/wwwroot/

**Method B: ZIP Deploy**
```bash
# Create ZIP of your website
cd website-deploy
zip -r website.zip *

# Deploy using Azure CLI
az webapp deployment source config-zip \
  --resource-group GoldenValleyTransit-RG \
  --name goldenvalleytransit \
  --src website.zip
```

**Method C: Git Deployment**
```bash
# In your website folder
git init
git add .
git commit -m "Initial website"

# Get deployment URL from Azure Portal > Deployment Center
git remote add azure [deployment-url-from-azure]
git push azure master
```

#### **STEP 3: Configure Custom Domain**

1. In App Service, click "Custom domains"
2. Click "Add custom domain"
3. Enter your domain
4. Add DNS records at your registrar:
   - CNAME: www → goldenvalleytransit.azurewebsites.net
   - A record: @ → [IP shown in Azure]
5. Verify domain ownership

#### **STEP 4: Enable HTTPS**

1. In App Service, click "TLS/SSL settings"
2. Click "Private Key Certificates (.pfx)"
3. Click "Create App Service Managed Certificate" (FREE)
4. Select your custom domain
5. Create certificate
6. Go to "Bindings" tab
7. Add TLS/SSL binding for your domain

---

## OPTION 3: AZURE BLOB STORAGE + CDN

### When to use:
- Want absolute minimum cost ($1-5/month)
- Static website only
- Need global CDN for speed

### Deployment Steps:

#### **STEP 1: Create Storage Account**

1. Azure Portal > Create a resource
2. Search "Storage Account"
3. Create

**Configuration:**
```
Resource Group: GoldenValleyTransit-RG
Storage account name: gvtwebsite (must be unique globally)
Region: West US 2
Performance: Standard
Redundancy: LRS (Locally Redundant Storage)
```

#### **STEP 2: Enable Static Website**

1. Go to Storage Account
2. In left menu, find "Static website"
3. Click "Enabled"
4. Index document name: `index.html`
5. Error document path: `404.html` (optional)
6. Click "Save"
7. Note the "Primary endpoint" URL

#### **STEP 3: Upload Files**

**Using Azure Portal:**
1. Go to "Containers"
2. Click on "$web" container (auto-created)
3. Click "Upload"
4. Select your index.html file
5. Upload

**Using Azure Storage Explorer** (recommended):
1. Download: https://azure.microsoft.com/en-us/features/storage-explorer/
2. Connect to your Azure account
3. Navigate to Storage Account > Blob Containers > $web
4. Drag and drop index.html

**Using Azure CLI:**
```bash
az storage blob upload-batch \
  --account-name gvtwebsite \
  --source ./website-deploy \
  --destination '$web'
```

#### **STEP 4: Configure Custom Domain**

1. In Storage Account, go to "Static website"
2. Note your endpoint (e.g., gvtwebsite.z22.web.core.windows.net)
3. At your domain registrar, add CNAME:
   - Name: `www`
   - Value: `gvtwebsite.z22.web.core.windows.net`

#### **STEP 5: Add Azure CDN (Optional but recommended)**

1. In Storage Account, click "Azure CDN"
2. Create new CDN profile:
   - Name: GoldenValleyTransit-CDN
   - Pricing tier: Standard Microsoft (cheapest)
3. Create endpoint
4. Add custom domain to CDN endpoint
5. Enable HTTPS

---

## 📊 COMPARISON TABLE

| Feature | Static Web Apps | App Service (B1) | Blob Storage + CDN |
|---------|----------------|------------------|--------------------|
| **Cost** | FREE | $13/month | $1-5/month |
| **Deployment** | Very Easy | Easy | Easy |
| **Custom Domain** | ✅ Free | ✅ Free | ✅ Free |
| **SSL/HTTPS** | ✅ Auto | ✅ Auto | ✅ Via CDN |
| **Backend API** | Limited | ✅ Full | ❌ No |
| **Staging** | ✅ Yes | ✅ Yes | ❌ No |
| **Best For** | Simple sites | Full apps | Ultra-low cost |

---

## 🎯 RECOMMENDED APPROACH

### **For Golden Valley Transit:**

**Phase 1: Launch (Now) - Azure Static Web Apps**
- **Why:** FREE, fast, professional
- **Timeline:** Deploy today
- **URL:** goldenvalleytransit.azurestaticapps.net (temporary)
- **Custom domain:** Add your domain within 24 hours

**Phase 2: Production (When funded) - Keep Static Web Apps**
- **Why:** No need to change if it works great
- **Or upgrade to:** App Service B1 if you need backend features
- **Cost:** $0-13/month

---

## 🔧 AZURE CLI COMMANDS (Quick Reference)

### Install Azure CLI
```bash
# Windows
winget install -e --id Microsoft.AzureCLI

# Mac
brew install azure-cli

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Login
```bash
az login
```

### Create Resource Group
```bash
az group create \
  --name GoldenValleyTransit-RG \
  --location westus2
```

### Deploy Static Web App
```bash
az staticwebapp create \
  --name goldenvalleytransit \
  --resource-group GoldenValleyTransit-RG \
  --location westus2
```

### Upload to Storage
```bash
az storage blob upload-batch \
  --account-name gvtwebsite \
  --source ./website-deploy \
  --destination '$web'
```

---

## 📧 DOMAIN & EMAIL SETUP

### Connect Your Existing Domain

**DNS Records to Add:**

For Static Web Apps:
```
Type: CNAME
Name: www
Value: [your-app].azurestaticapps.net
TTL: 3600

Type: TXT
Name: @
Value: [verification code from Azure]
TTL: 3600
```

For root domain (@ or apex):
```
Type: A
Name: @
Value: [IP address from Azure]
TTL: 3600
```

### Setup Professional Email

**Option 1: Microsoft 365 Business Basic** ($6/user/month)
- Professional email: info@goldenvalleytransit.com
- Includes: Outlook, Teams, OneDrive
- Already integrates with your Azure account

**Option 2: Google Workspace** ($6/user/month)
- Professional email with Gmail interface
- Includes: Drive, Calendar, Meet

**Option 3: Domain Provider Email** (Often FREE)
- Check if your domain registrar offers email
- Usually included or $1-2/month

---

## ✅ POST-DEPLOYMENT CHECKLIST

After website is live:

**Immediately:**
- [ ] Visit website at Azure URL - confirm it loads
- [ ] Test on mobile device
- [ ] Check all links work
- [ ] Test contact form
- [ ] Verify phone number clickable

**Within 24 hours:**
- [ ] Add custom domain DNS records
- [ ] Wait for DNS propagation (1-24 hours)
- [ ] Verify HTTPS works
- [ ] Test from different locations/devices

**Within 1 week:**
- [ ] Setup Google Analytics (optional)
- [ ] Submit to Google Search Console
- [ ] Create business listings (Google My Business)
- [ ] Update all applications with website URL

---

## 🆘 TROUBLESHOOTING

### **Website not loading**
- Check DNS propagation: https://dnschecker.org
- Clear browser cache (Ctrl+Shift+Delete)
- Wait up to 24 hours for DNS changes

### **HTTPS not working**
- Certificate takes 15-60 minutes to provision
- Ensure domain is validated first
- Try accessing via www.yourdomain.com

### **Custom domain not connecting**
- Verify DNS records exactly match Azure instructions
- Check for typos in CNAME/A records
- Remove any conflicting DNS records

### **Files not updating**
- Clear CDN cache in Azure Portal
- Hard refresh browser (Ctrl+F5)
- Check file upload completed successfully

---

## 📱 TESTING YOUR SITE

### **Before going live, test:**
1. Desktop browsers (Chrome, Firefox, Edge, Safari)
2. Mobile browsers (iOS Safari, Android Chrome)
3. Tablet devices
4. Different internet connections
5. All interactive elements (links, forms, buttons)

### **Performance check:**
- Google PageSpeed Insights: https://pagespeed.web.dev
- GTmetrix: https://gtmetrix.com
- Target: 90+ score on PageSpeed

---

## 💰 COST ESTIMATION

### **Minimal Setup (Static Web Apps):**
```
Azure Static Web App: $0/month (free tier)
Domain registration: Already owned
Email (Google Workspace): $6/month
-----------------------------------------
Total: $6/month = $72/year
```

### **Professional Setup (App Service):**
```
Azure App Service B1: $13/month
Domain: Already owned
Email (Microsoft 365): $6/month
-----------------------------------------
Total: $19/month = $228/year
```

### **Ultra-Budget Setup (Blob Storage):**
```
Azure Blob Storage: $1-2/month
CDN: $3-5/month
Domain: Already owned
Email (Google Workspace): $6/month
-----------------------------------------
Total: $10-13/month = $120-156/year
```

---

## 🎯 RECOMMENDED: START WITH STATIC WEB APPS

**Why this is perfect for you:**

✅ **FREE** - Zero hosting cost
✅ **Fast** - Global CDN included
✅ **Professional** - Enterprise Azure infrastructure
✅ **SSL** - Automatic HTTPS
✅ **Easy** - Deploy in 15 minutes
✅ **Scalable** - Handle thousands of visitors

**Timeline:**
- Today: Deploy to Azure Static Web Apps
- Tomorrow: Add your custom domain
- Day 3: Live and professional!
- Insurance applications: Include website URL immediately

---

## 📞 NEED HELP?

If you encounter any issues:

1. **Azure Documentation:** https://docs.microsoft.com/azure
2. **Azure Support:** Built into Azure Portal
3. **Community Forums:** https://stackoverflow.com (tag: azure)
4. **Video Tutorials:** Search "Azure Static Web Apps tutorial" on YouTube

---

## 🚀 READY TO DEPLOY?

Your website files are ready in: `/home/claude/website-deploy/index.html`

**Next steps:**
1. Login to Azure Portal
2. Create Static Web App
3. Upload index.html
4. Add your domain
5. Go live!

**Estimated time:** 30 minutes from start to finish

═══════════════════════════════════════════════════════════════════

**Your Golden Valley Transit website will be live and professional, ready to impress insurance payers!**
