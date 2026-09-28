"""Email copy. `{placeholders}` are filled with str.format.

Arabic covers the customer emails only: staff emails are sent in English or French.
"""

STRINGS: dict[str, dict[str, str]] = {
    "en": {
        "brand_tagline": "Spreads & pastry creams",
        "list_sep": ", ",
        "hello": "Hello {name},",
        # customer: order placed
        "confirm_subject": "Order {code} received",
        "confirm_intro": "Thank you for your order. We'll call you on {phone} to confirm it "
        "before it ships.",
        "your_code": "Your order code",
        "keep_code": "Keep this code to follow your delivery.",
        "track_button": "Track my order",
        # customer: status updates
        "status_subject_validated": "Order {code} confirmed",
        "status_subject_shipped": "Order {code} is on its way",
        "status_subject_delivered": "Order {code} delivered",
        "status_subject_cancelled": "Order {code} cancelled",
        "status_intro_validated": "Your order is confirmed. We're preparing it now.",
        "status_intro_shipped": "Your order has left our warehouse and is on its way to you. "
        "Please have {total} ready for the courier.",
        "status_intro_delivered": "Your order has been delivered. Enjoy, and thank you for "
        "choosing Mordjane!",
        "status_intro_cancelled": "Your order has been cancelled. If this is unexpected, "
        "reply to this email or call us.",
        # order summary
        "order_heading": "Your order",
        "product": "Product",
        "qty": "Qty",
        "amount": "Amount",
        "subtotal": "Subtotal",
        "delivery": "Delivery ({city})",
        "total": "Total",
        "payment": "Payment",
        "cod": "Cash on delivery",
        "deliver_to": "Delivery address",
        "placed_on": "Placed on {date}",
        "footer": "You're receiving this email because you ordered from Mordjane.",
        # admin
        "admin_new_subject": "New order {code}: {total}, {city}",
        "admin_new_intro": "A new order was placed and is waiting for validation.",
        "admin_status_subject": "Order {code}: {from_status} → {to_status}",
        "admin_status_intro": "Order {code} moved from {from_status} to {to_status}.",
        "admin_note": "Note",
        "customer": "Customer",
        "open_admin": "Open in admin",
        "admin_low_subject": "Low stock: {count} size(s) at or below {threshold}",
        "admin_low_intro": "These sizes just reached the low-stock level ({threshold} or fewer "
        "left). Restock or switch them off.",
        "stock_left": "Left",
        "open_products": "Manage products",
        "admin_footer": "Staff notification from your Mordjane shop. Change who receives "
        "these emails under Admin → Notifications.",
        "test_subject": "Test email from Mordjane",
        "test_intro": "Your email settings work: this message reached you from the shop.",
        "status_pending": "Pending",
        "status_validated": "Validated",
        "status_shipped": "Shipped",
        "status_delivered": "Delivered",
        "status_cancelled": "Cancelled",
    },
    "fr": {
        "brand_tagline": "Crèmes & pâtisserie",
        "list_sep": ", ",
        "hello": "Bonjour {name},",
        "confirm_subject": "Commande {code} reçue",
        "confirm_intro": "Merci pour votre commande. Nous vous appellerons au {phone} pour la "
        "confirmer avant l'expédition.",
        "your_code": "Votre code de commande",
        "keep_code": "Conservez ce code pour suivre votre livraison.",
        "track_button": "Suivre ma commande",
        "status_subject_validated": "Commande {code} confirmée",
        "status_subject_shipped": "Commande {code} expédiée",
        "status_subject_delivered": "Commande {code} livrée",
        "status_subject_cancelled": "Commande {code} annulée",
        "status_intro_validated": "Votre commande est confirmée. Nous la préparons.",
        "status_intro_shipped": "Votre commande a quitté notre entrepôt et arrive chez vous. "
        "Merci de préparer {total} pour le livreur.",
        "status_intro_delivered": "Votre commande a été livrée. Bonne dégustation et merci "
        "d'avoir choisi Mordjane !",
        "status_intro_cancelled": "Votre commande a été annulée. Si c'est inattendu, "
        "répondez à cet e-mail ou appelez-nous.",
        "order_heading": "Votre commande",
        "product": "Produit",
        "qty": "Qté",
        "amount": "Montant",
        "subtotal": "Sous-total",
        "delivery": "Livraison ({city})",
        "total": "Total",
        "payment": "Paiement",
        "cod": "À la livraison, en espèces",
        "deliver_to": "Adresse de livraison",
        "placed_on": "Passée le {date}",
        "footer": "Vous recevez cet e-mail car vous avez commandé chez Mordjane.",
        "admin_new_subject": "Nouvelle commande {code} : {total}, {city}",
        "admin_new_intro": "Une nouvelle commande attend votre validation.",
        "admin_status_subject": "Commande {code} : {from_status} → {to_status}",
        "admin_status_intro": "La commande {code} est passée de « {from_status} » à "
        "« {to_status} ».",
        "admin_note": "Note",
        "customer": "Client",
        "open_admin": "Ouvrir dans l'admin",
        "admin_low_subject": "Stock faible : {count} format(s) à {threshold} ou moins",
        "admin_low_intro": "Ces formats viennent d'atteindre le seuil de stock faible "
        "({threshold} ou moins). Réapprovisionnez-les ou désactivez-les.",
        "stock_left": "Reste",
        "open_products": "Gérer les produits",
        "admin_footer": "Notification équipe de votre boutique Mordjane. Choisissez qui "
        "reçoit ces e-mails dans Admin → Notifications.",
        "test_subject": "E-mail de test Mordjane",
        "test_intro": "Vos réglages e-mail fonctionnent : ce message vous a été envoyé par "
        "la boutique.",
        "status_pending": "En attente",
        "status_validated": "Validée",
        "status_shipped": "Expédiée",
        "status_delivered": "Livrée",
        "status_cancelled": "Annulée",
    },
}

# Customer emails in Arabic. \u2066…\u2069 isolate left-to-right values (phone, amount) so
# they keep their order inside right-to-left sentences.
STRINGS["ar"] = {
    **STRINGS["fr"],
    "brand_tagline": "كريمات ومستلزمات الحلويات",
    "list_sep": "، ",
    "hello": "مرحبًا {name}،",
    "confirm_subject": "تم استلام طلبك {code}",
    "confirm_intro": "شكرًا على طلبك. سنتصل بك على الرقم \u2066{phone}\u2069 لتأكيده قبل الشحن.",
    "your_code": "رمز طلبك",
    "keep_code": "احتفظ بهذا الرمز لمتابعة التوصيل.",
    "track_button": "تتبّع طلبي",
    "status_subject_validated": "تم تأكيد طلبك {code}",
    "status_subject_shipped": "طلبك {code} في الطريق إليك",
    "status_subject_delivered": "تم تسليم طلبك {code}",
    "status_subject_cancelled": "تم إلغاء طلبك {code}",
    "status_intro_validated": "تم تأكيد طلبك ونحن بصدد تجهيزه.",
    "status_intro_shipped": "غادر طلبك مخزننا وهو في الطريق إليك. يُرجى تجهيز مبلغ "
    "\u2066{total}\u2069 للموزّع.",
    "status_intro_delivered": "تم تسليم طلبك. بالهناء والشفاء، وشكرًا لاختيارك Mordjane!",
    "status_intro_cancelled": "تم إلغاء طلبك. إن لم يكن ذلك متوقعًا، رُدّ على هذه الرسالة "
    "أو اتصل بنا.",
    "order_heading": "طلبك",
    "product": "المنتج",
    "qty": "الكمية",
    "amount": "المبلغ",
    "subtotal": "المجموع الفرعي",
    "delivery": "التوصيل ({city})",
    "total": "المجموع",
    "payment": "الدفع",
    "cod": "نقدًا عند الاستلام",
    "deliver_to": "عنوان التوصيل",
    "placed_on": "بتاريخ {date}",
    "footer": "تصلك هذه الرسالة لأنك طلبت من متجر Mordjane.",
    "status_pending": "في الانتظار",
    "status_validated": "مؤكَّد",
    "status_shipped": "تم الشحن",
    "status_delivered": "تم التسليم",
    "status_cancelled": "ملغى",
}
