import VueRouter from 'vue-router';
import logger from 'kolibri.lib.logging';

const logging = logger.getLogger(__filename);

/** Wrapper around Vue Router.
 *  Implements URL mapping to Vuex actions in addition to Vue components.
 *  Otherwise intended as a mostly transparent replacement to vue-router.
 */
class Router {
  /**
   * Create a Router instance.
   */
  constructor() {
    this._vueRouter = new VueRouter({
      scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
          return savedPosition;
        } else {
          return { x: 0, y: 0 };
        }
      },
    });
    this._actions = {};
    this._routes = {};
  }

  _hook(toRoute, fromRoute, next) {
    if (this._actions[toRoute.name]) {
      this._actions[toRoute.name](toRoute, fromRoute);
    }
    next();
  }

  init(routes) {
    routes.forEach(route => {
      // if no name was passed but a component was, use the component's name
      if (!route.name && route.component) {
        route.name = route.component.name;
      }
      // if a handler was passed, associate it with the router using a beforeEach hook
      if (route.handler) {
        this._actions[route.name] = route.handler;
        delete route.handler;
      }
      // save a copy of the route names for later lookup
      this._routes[route.name] = route;
    });

    // add the routes to the router
    this._vueRouter.addRoutes(routes);

    // attach a helper method that generates a route object and warns if it's not valid
    this._vueRouter.getRoute = this.getRoute = (name, params = {}, query = {}) => {
      if (!this._routes[name]) {
        logging.warn(`Route name '${name}' is not registered`);
      }
      return { name, params, query };
    };

    // attach a helper method that returns original route definition
    this._vueRouter.getRouteDefinition = this.getRouteDefinition = name => {
      return this._routes[name];
    };

    // return a copy of underlying router
    return this._vueRouter;
  }

  enableHandlers() {
    this._vueRouter.beforeEach(this._hook.bind(this));
  }

  /****************************/
  /* vue-router proxy methods */
  /****************************/

  replace(location, onComplete, onAbort) {
    return this._vueRouter.replace(location, onComplete, onAbort);
  }

  push(location, onComplete, onAbort) {
    return this._vueRouter.push(location, onComplete, onAbort);
  }

  go(location, onComplete, onAbort) {
    return this._vueRouter.go(location, onComplete, onAbort);
  }

  back(location, onComplete, onAbort) {
    return this._vueRouter.back(location, onComplete, onAbort);
  }

  forward(location, onComplete, onAbort) {
    return this._vueRouter.forward(location, onComplete, onAbort);
  }

  afterEach(func) {
    return this._vueRouter.afterEach(func);
  }

  beforeResolve(func) {
    return this._vueRouter.beforeResolve(func);
  }

  beforeEach(func) {
    return this._vueRouter.beforeEach(func);
  }
}

const router = new Router();

export { router as default };
