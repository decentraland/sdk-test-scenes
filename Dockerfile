FROM node:lts-alpine

# Create app directory
WORKDIR /usr/src/app

COPY test-scenes/scene.json ./

# RUN npm install --global decentraland@next
RUN npm i -g "https://sdk-team-cdn.decentraland.org/decentraland-cli/branch/feat/add-skip-build-in-dcl-start/decentraland-3.8.4-20220209124116.commit-471783c.tgz"

COPY test-scenes/package*.json ./
RUN npm install

COPY ./test-scenes/ .

EXPOSE 8000
CMD [ "npm", "start", "--", "--ci", "--skip-build" ]