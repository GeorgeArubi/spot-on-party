(defproject sopbase "1.0.0-SNAPSHOT"
  :description "Backend for the spot-on-party spotify colaborative party playlist generation app"
  :aot [sopbase.core]
  :dependencies [[org.clojure/clojure "1.3.0"]
                 [compojure "1.1.0"]
                 [appengine "0.4.3-SNAPSHOT"]
                 [ring/ring-servlet "1.1.0"]]
  :plugins [[lein-ring "0.7.1"]]
  :ring {:handler sopbase.core/app}
  :compile-path "war/WEB-INF/classes"
  :library-path "war/WEB-INF/lib")

