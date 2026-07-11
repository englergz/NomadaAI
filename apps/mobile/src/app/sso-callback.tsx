// Destino del deep link del OAuth (nomadaai://sso-callback): Clerk ya procesó la
// sesión en este punto; esta ruta solo existe para que el router no muestre un
// 404 («page could not be found») — redirige de inmediato al mapa.
import { Redirect } from 'expo-router';

export default function SsoCallback() {
  return <Redirect href="/" />;
}
