// Achats Apple (StoreKit 2) pour Sahbi Pro : prix, achat, abonnements en cours, gestion de l'abonnement.
import Foundation
import Capacitor
import StoreKit
import AuthenticationServices
import CryptoKit

@objc(SahbiStorePlugin)
public class SahbiStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SahbiStorePlugin"
    public let jsName = "SahbiStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "owned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appleSignIn", returnType: CAPPluginReturnPromise),
    ]
    private var updates: Task<Void, Never>?
    private var appleDelegate: SahbiAppleDelegate?

    // Connexion avec Apple (natif) : renvoie le jeton d'identité + le nonce, que la page passe à Supabase.
    @objc func appleSignIn(_ call: CAPPluginCall) {
        let raw = UUID().uuidString + UUID().uuidString
        let hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
        DispatchQueue.main.async {
            let req = ASAuthorizationAppleIDProvider().createRequest()
            req.requestedScopes = [.fullName, .email]
            req.nonce = hashed
            let d = SahbiAppleDelegate(call: call, raw: raw, anchor: self.bridge?.webView?.window)
            self.appleDelegate = d
            let c = ASAuthorizationController(authorizationRequests: [req])
            c.delegate = d
            c.presentationContextProvider = d
            c.performRequests()
        }
    }

    override public func load() {
        // Renouvellements et achats terminés hors de l'app : on les termine et on prévient la page.
        updates = Task.detached { [weak self] in
            for await r in Transaction.updates {
                if case .verified(let t) = r { await t.finish() }
                self?.notifyListeners("transaction", data: ["jws": r.jwsRepresentation])
            }
        }
    }

    @objc func product(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task {
            do {
                guard let p = try await Product.products(for: [id]).first else { call.resolve([:]); return }
                call.resolve(["id": p.id, "price": p.displayPrice])
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func buy(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let account = UUID(uuidString: call.getString("user") ?? "")
        Task {
            do {
                guard let p = try await Product.products(for: [id]).first else { call.reject("not_found"); return }
                var opts: Set<Product.PurchaseOption> = []
                if let a = account { opts.insert(.appAccountToken(a)) }
                let r = try await p.purchase(options: opts)
                switch r {
                case .success(let v):
                    if case .verified(let t) = v { await t.finish() }
                    call.resolve(["status": "ok", "jws": v.jwsRepresentation])
                case .userCancelled: call.resolve(["status": "cancel"])
                case .pending: call.resolve(["status": "pending"])
                @unknown default: call.resolve(["status": "unknown"])
                }
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func owned(_ call: CAPPluginCall) {
        Task {
            var list: [String] = []
            for await r in Transaction.currentEntitlements { list.append(r.jwsRepresentation) }
            call.resolve(["jws": list])
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            try? await AppStore.sync()
            var list: [String] = []
            for await r in Transaction.currentEntitlements { list.append(r.jwsRepresentation) }
            call.resolve(["jws": list])
        }
    }

    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            if let scene = UIApplication.shared.connectedScenes.first(where: { $0 is UIWindowScene }) as? UIWindowScene {
                try? await AppStore.showManageSubscriptions(in: scene)
            }
            call.resolve()
        }
    }
}

class SahbiAppleDelegate: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    let call: CAPPluginCall
    let raw: String
    weak var anchor: UIWindow?
    init(call: CAPPluginCall, raw: String, anchor: UIWindow?) { self.call = call; self.raw = raw; self.anchor = anchor }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return anchor ?? ASPresentationAnchor()
    }
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let t = cred.identityToken, let token = String(data: t, encoding: .utf8) else { call.reject("no_token", "no_token"); return }
        let name = [cred.fullName?.givenName, cred.fullName?.familyName].compactMap { $0 }.joined(separator: " ")
        call.resolve(["token": token, "nonce": raw, "name": name])
    }
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let cancel = (error as? ASAuthorizationError)?.code == .canceled
        call.reject(cancel ? "cancel" : error.localizedDescription, cancel ? "cancel" : "error")
    }
}
