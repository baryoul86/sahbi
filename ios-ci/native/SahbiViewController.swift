// Écran principal de l'app : le pont Capacitor + le plugin d'achats Apple de Sahbi.
import UIKit
import Capacitor

class SahbiViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SahbiStorePlugin())
    }
}
