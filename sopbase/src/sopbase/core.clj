(ns sopbase.core
  (:use compojure.core)
  (:gen-class :extends javax.servlet.http.HttpServlet)
  (:require [compojure.route :as route]
            [compojure.handler :as handler]
            [ring.util.servlet :as servlet]))


(defroutes main-routes
  (GET "/" [] "<h1>HELLO SOPPERS</h1>It works!")
  (route/resources "/")
  (route/not-found "Page not found"))

(servlet/defservice main-routes)
