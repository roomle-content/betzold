# Create Rubens Content

To help to scaffold a project which uses Rubens CLI we created this template. This is inspired by tools like `create-react-app`, `create-vite-app` etc. A very simplified example of the mechanics can be found here: https://www.npmjs.com/package/create-esm

The whole magic relies on [npm init](https://docs.npmjs.com/cli/v7/commands/npm-init). And in background `npm init` relies on [npm exec](https://docs.npmjs.com/cli/v7/commands/npm-exec).

What happens in background is, that when you run `npm init` the package is downloaded to your local machine and stored at your global npm path. After that the command `npm exec` is run. Some things you need to consider that everything works nicely:

-   package.json: set the field `bin`, `files` and `main` correctly. Take care that only the needed runtime dependencies are in `dependencies` and out the rest into `devDependencies`.
-   `.gitignore`: be aware that `.gitignore` removes things from the npm package. Therefore we named the default `.gitignore` `_gitignore` and rename it when we copy it over to the final project path.

To test what will happen while `npm init` you just need to `node index.js` and see what's going on
