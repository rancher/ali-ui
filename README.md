# ali-ui
Rancher Extension used in [rancher/dashboard](https://github.com/rancher/dashboard) to provision Alibaba Cloud clusters.

## Running for Development
This is what you probably want to get started.
```bash
# Install dependencies
yarn install --frozen-lockfile

# For development, serve with hot reload at https://localhost:8005
# using the endpoint for your Rancher API
API=https://your-rancher yarn dev
# or put the variable into a .env file
# Goto https://localhost:8005
```

## Updating @shell package
This is about updating the @shell package which is the base from rancher/dashboard
```bash
# Update
yarn create @rancher/update
```

## Building the extension for production
Bump the app version on `package.json` file, then run:
```bash
# Build for production
yarn publish-pkgs
# add flag -f if you need to overwrite an existing version


# If you need to test the built extension
yarn serve-pkgs
```

## Installing released versions of the Ali UI
NOTE: This UI is currently in development.

License
=======
Check Ali UI Apache License details [here](LICENSE)# ali-ui
