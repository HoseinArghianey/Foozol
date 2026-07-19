// wrapper برای route handlerهای async تا نیازی به try/catch تکراری نباشد
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
