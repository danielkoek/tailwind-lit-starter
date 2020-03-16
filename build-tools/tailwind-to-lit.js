// base folder structure:
const webComponentsFolder = "./src/js/";
const templateFolder = "./src/template/";
const cssFolder = "./src/css/";
const jsStyleFolder = webComponentsFolder + "Style/";

// file to build all from
const baseCss = cssFolder + "tailwind.css";
//read these files and remove any css that isn't in here
const purgeFilter = [
  webComponentsFolder + "**/*.js",
  templateFolder + "**/*.html"
];
//Clean these folder, otherwise the purge will find css classes that aren't used
const cleanOutDirectories = [
  webComponentsFolder + "/web_modules/",
  jsStyleFolder
];

//normal CSS:
const cssBuild = cssFolder + "tailwind.build.css";

// LIT+ JS:

// where to place the js file for the lit-html to import
const jsBuild = jsStyleFolder + "tailwind.js";
// where is lit relative to the file above
const jsBuildLitLocation = "../web_modules/lit-element.js";

//AMP:

// amp pages need to be supper tiny so where do you want to build that css file
const cssAmpBuild = cssFolder + "tailwind.amp.css";
// and what files need to be used to purge it
const ampPurgeFilter = [templateFolder + "amp/*.html"];

const postcss = require("postcss");
const fs = require("fs");
const nano = require("cssnano")({
  preset: [
    "default",
    {
      discardComments: {
        removeAll: true
      }
    }
  ]
});
const devPlugins = [require("tailwindcss"), require("autoprefixer")];

const purge = filter =>
  require("@fullhuman/postcss-purgecss")({
    content: filter,
    defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g)
  });

cleanOutDirectories.forEach(directory => {
  //make sure that the folder is there
  fs.mkdir(directory, err => {
    if (err) {
      if (err.code === "EEXIST") return;
      throw err;
    }
  });
  //read and remove the files
  fs.readdir(directory, (err, files) => {
    if (err) throw err;
    files.forEach(file =>
      fs.unlink(directory + file, err => {
        if (err) throw err;
        console.log(`Removed ${file}`);
      })
    );
  });
});

fs.readFile(baseCss, (err, css) => {
  if (err) throw err;
  function callbackWrite(err, file) {
    if (err) throw err;
    console.log(`Done writing file ${file}`);
  }
  const prod = false;
  // amp only, build when it doesn't exist or when you are in prod mode!
  if (prod || !fs.existsSync(cssAmpBuild)) {
    postcss([...devPlugins, purge(ampPurgeFilter), nano])
      .process(css, { from: baseCss, to: cssAmpBuild })
      .then(result =>
        fs.writeFile(cssAmpBuild, result.css, err =>
          callbackWrite(err, cssAmpBuild)
        )
      );
  }
  const prodPlugins = [...devPlugins, purge(purgeFilter), nano];
  const plugins = prod ? prodPlugins : devPlugins;
  postcss(plugins)
    .process(css, { from: baseCss, to: jsBuild })
    .then(result => {
      fs.writeFile(cssBuild, result.css, err => callbackWrite(err, cssBuild));
      const jsTemplate = `
                import { css } from '${jsBuildLitLocation}';
                export default css\`${result.css
                  .replace(/\\/g, "\\\\")
                  .replace(/`/g, "\\`")}\`;
            `;
      fs.writeFile(jsBuild, jsTemplate, err => callbackWrite(err, jsBuild));
    });
});
