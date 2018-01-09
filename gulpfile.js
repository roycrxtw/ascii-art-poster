
const gulp = require('gulp');
const browserSync = require('browser-sync');
const nodemon = require('gulp-nodemon');

const paths = ['public/**/*.css', 'views/*.*'];

function reload(done) {
  browserSync.reload();
  done();
}

function serve(done) {
  browserSync.init({
    proxy: 'http://localhost:3002',
    port: 3000
  });
  done();
}

const scripts = (done) => {
  let isOnline = false;

  return nodemon({
    script: 'index.js'
  }).on('start', () => {
    if(!isOnline){
      isOnline = true;
      done();
    }
  }).on('restart', () => {
    //reload();
  });
};

const watch = () => gulp.watch(paths, reload);

gulp.task('default', gulp.series(scripts, serve, watch), () => {
  console.log('The end of gulp');
});
